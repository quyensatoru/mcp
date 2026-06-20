import { z } from 'zod';
import mongoose from 'mongoose';
import { okContent, errorContent } from '../helpers/format.helper.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { getShardConns } from '../services/shard-resolver.service.js';
import { getSessionModel } from '../models/api/session.model.js';
import { getPageViewModel } from '../models/api/pageview.model.js';
import { getEventModel } from '../models/api/event.model.js';
import { getBehaviorModel } from '../models/api/behavior.model.js';
import { getVisitorModel } from '../models/api/visitor.model.js';
import { getAnalyticModel } from '../models/api/analytic.model.js';
import { getShopModel } from '../models/api/shop.model.js';
import { getSnapshotModel } from '../models/heatmap/snapshot.model.js';

const MONGO_TTL = 120;
const ObjectId = mongoose.Types.ObjectId;

function tryObjectId(str) {
  try { return new ObjectId(str); } catch { return null; }
}

function wrap(name, fn) {
  return async (args) => {
    try { return await fn(args); }
    catch (err) { return errorContent(`${name}: ${err.message}`, 'Kiểm tra domain, sessionId/pageViewId đúng định dạng ObjectId hoặc session key.'); }
  };
}

export function registerMongoPipelineTools(server) {

  // ── Group C: Session trace ────────────────────────────────────────────────

  server.registerTool('mongo_session_trace', {
    title: 'Mongo Session Trace',
    description: 'Đi dọc pipeline Session→PageView→Event/Behavior, đếm ở từng tầng, cắm cờ chỗ đứt. Ví dụ: có Session nhưng 0 PageView = recording hỏng ở tầng ingest. Đây là tool chẩn đoán "không ghi" cốt lõi.',
    inputSchema: z.object({
      domain: z.string().describe('Shopify domain'),
      sessionId: z.string().optional().describe('ObjectId của session'),
      sessionKey: z.string().optional().describe('session.key (UUID từ client)'),
    }),
  }, wrap('mongo_session_trace', async ({ domain, sessionId, sessionKey }) => {
    const key = cacheKey('mongo_session_trace', { domain, sessionId, sessionKey });
    const result = await withCache(key, MONGO_TTL, async () => {
      const { api } = await getShardConns(domain);
      const Session = getSessionModel(api);
      const PageView = getPageViewModel(api);
      const Event = getEventModel(api);
      const Behavior = getBehaviorModel(api);

      // 1. Find session
      const sessionFilter = sessionId
        ? { _id: tryObjectId(sessionId) }
        : { key: sessionKey };
      const session = await Session.findOne(sessionFilter).lean().exec();
      if (!session) return { found: false, message: `Session không tồn tại trong api (shard=${domain})` };

      // 2. PageViews
      const pageviews = await PageView.find({ session: session._id }, { _id: 1, href: 1, page_type: 1, theme_template: 1, start_time: 1, end_time: 1, status: 1 }).lean().exec();

      // 3. Events + Behaviors per pageview
      const pvIds = pageviews.map(p => p._id);
      const [eventCount, behaviorCount] = await Promise.all([
        pvIds.length ? Event.countDocuments({ pageView: { $in: pvIds } }).exec() : 0,
        pvIds.length ? Behavior.countDocuments({ session: session._id }).exec() : 0,
      ]);

      // 4. Flags
      const flags = [];
      if (!pageviews.length) flags.push('⚠️ Session tồn tại nhưng 0 PageView — ingest/queue có thể lỗi');
      else if (eventCount === 0) flags.push('⚠️ Có PageView nhưng 0 Event (rrweb) — recording script không gửi data hoặc consumer drop');
      if (session.status === false) flags.push('ℹ️ Session chưa closed (status=false)');

      return {
        session: {
          _id: session._id, key: session.key, device: session.device,
          browser: session.browser, location: session.location,
          start_time: session.start_time, last_active: session.last_active,
          duration: session.duration, status: session.status,
          frustrated: session.frustrated, page_per_session: session.page_per_session,
        },
        counts: { pageviews: pageviews.length, events: eventCount, behaviors: behaviorCount },
        pageviews,
        flags,
        diagnosis: flags.length ? 'ISSUE_DETECTED' : 'OK',
      };
    });
    return okContent(result, { label: `Session trace: ${sessionId ?? sessionKey}` });
  }));

  server.registerTool('mongo_get_session', {
    title: 'Mongo Get Session',
    description: 'Lấy full session doc + visitor liên kết. Dùng sau mongo_session_trace để xem chi tiết.',
    inputSchema: z.object({
      domain: z.string(),
      sessionId: z.string().optional(),
      sessionKey: z.string().optional(),
    }),
  }, wrap('mongo_get_session', async ({ domain, sessionId, sessionKey }) => {
    const { api } = await getShardConns(domain);
    const Session = getSessionModel(api);
    const Visitor = getVisitorModel(api);
    const filter = sessionId ? { _id: tryObjectId(sessionId) } : { key: sessionKey };
    const session = await Session.findOne(filter).lean().exec();
    if (!session) return errorContent('Session không tìm thấy');
    const visitor = session.visitor ? await Visitor.findById(session.visitor).lean().exec() : null;
    return okContent({ session, visitor }, { label: `Session: ${session.key}` });
  }));

  server.registerTool('mongo_get_pageviews', {
    title: 'Mongo Get PageViews',
    description: 'Danh sách PageView của một session (href, page_type, theme_template, timestamps).',
    inputSchema: z.object({
      domain: z.string(),
      sessionId: z.string().describe('ObjectId của session'),
    }),
  }, wrap('mongo_get_pageviews', async ({ domain, sessionId }) => {
    const { api } = await getShardConns(domain);
    const PageView = getPageViewModel(api);
    const pageviews = await PageView.find(
      { session: tryObjectId(sessionId) },
      { href: 1, page_type: 1, theme_template: 1, start_time: 1, end_time: 1, status: 1, page: 1, key: 1 }
    ).lean().exec();
    return okContent({ count: pageviews.length, pageviews }, { label: `PageViews of session ${sessionId}` });
  }));

  server.registerTool('mongo_get_behaviors', {
    title: 'Mongo Get Behaviors',
    description: 'Behavior events (cart, funnel, ux issue) theo session hoặc pageView. Dùng để chẩn đoán funnel/conversion issues.',
    inputSchema: z.object({
      domain: z.string(),
      sessionId: z.string().optional().describe('Lấy tất cả behaviors của session'),
      pageViewId: z.string().optional().describe('Lấy behaviors của 1 pageview cụ thể'),
      limit: z.number().int().min(1).max(200).default(50),
    }),
  }, wrap('mongo_get_behaviors', async ({ domain, sessionId, pageViewId, limit }) => {
    const { api } = await getShardConns(domain);
    const Behavior = getBehaviorModel(api);
    const filter = pageViewId
      ? { pageView: tryObjectId(pageViewId) }
      : { session: tryObjectId(sessionId) };
    const behaviors = await Behavior.find(filter).sort({ timestamp: 1 }).limit(limit).lean().exec();
    return okContent({ count: behaviors.length, behaviors }, { label: `Behaviors (${behaviors.length})` });
  }));

  // ── Group D: rrweb data ────────────────────────────────────────────────────

  server.registerTool('mongo_get_events', {
    title: 'Mongo Get Events (rrweb)',
    description: 'Đọc rrweb replay Events theo pageViewId, tự giải nén gzip+base64. Kết quả dùng cho rrweb_render. Chú ý: events có thể rất nhiều, dùng limit.',
    inputSchema: z.object({
      domain: z.string(),
      pageViewId: z.string().describe('ObjectId của PageView'),
      limit: z.number().int().min(1).max(2000).default(500).describe('Giới hạn số events (tăng nếu cần replay đầy đủ)'),
    }),
  }, wrap('mongo_get_events', async ({ domain, pageViewId, limit }) => {
    const { api } = await getShardConns(domain);
    const Event = getEventModel(api);
    // Không cache vì data lớn và ít thay đổi sau session close
    const events = await Event.find({ pageView: tryObjectId(pageViewId) })
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean({ getters: true }) // Apply decompress getter
      .exec();
    return okContent({
      count: events.length,
      pageViewId,
      events: events.map(e => ({ type: e.type, timestamp: e.timestamp, data: e.data })),
    }, { label: `rrweb Events (${events.length}) for pageView ${pageViewId}` });
  }));

  server.registerTool('mongo_get_snapshot', {
    title: 'Mongo Get Snapshot (rrweb full DOM)',
    description: 'Đọc Snapshot (full DOM snapshot) của một Page từ HeatmapV{n}, tự giải nén. Dùng cho rrweb_diagnose.',
    inputSchema: z.object({
      domain: z.string(),
      pageId: z.string().describe('ObjectId của Page'),
    }),
  }, wrap('mongo_get_snapshot', async ({ domain, pageId }) => {
    const { heatmap } = await getShardConns(domain);
    const Snapshot = getSnapshotModel(heatmap);
    const snapshot = await Snapshot.findOne({ page: tryObjectId(pageId) })
      .lean({ getters: true })
      .exec();
    if (!snapshot) return errorContent(`Snapshot không tìm thấy cho page ${pageId}`, 'Có thể heatmap chưa chạy hoặc page chưa có đủ pageviews.');
    return okContent({
      _id: snapshot._id,
      href: snapshot.type4?.href,
      width: snapshot.type4?.width,
      height: snapshot.type4?.height,
      timestamp: snapshot.timestamp,
      device: snapshot.device,
      hasType2: !!snapshot.type2,
      snapshotKeys: snapshot.type2 ? Object.keys(snapshot.type2) : [],
    }, { label: `Snapshot for page ${pageId}` });
  }));

  // ── Group E: Analytics ─────────────────────────────────────────────────────

  server.registerTool('mongo_get_analytic', {
    title: 'Mongo Get Analytic',
    description: 'Lấy Analytic theo ngày (visitor/session counts, order_funnel, bounce/conversion_rate). Dùng để đối chiếu "số liệu có cộng dồn đúng không".',
    inputSchema: z.object({
      domain: z.string(),
      dateFrom: z.string().describe('YYYY-MM-DD'),
      dateTo: z.string().describe('YYYY-MM-DD'),
    }),
  }, wrap('mongo_get_analytic', async ({ domain, dateFrom, dateTo }) => {
    const key = cacheKey('mongo_get_analytic', { domain, dateFrom, dateTo });
    const result = await withCache(key, 300, async () => {
      const { api } = await getShardConns(domain);
      const Shop = getShopModel(api);
      const Analytic = getAnalyticModel(api);
      const shop = await Shop.findOne({ domain }, { _id: 1 }).lean().exec();
      if (!shop) return { found: false };
      const analytics = await Analytic.find({
        shop: shop._id,
        date: { $gte: dateFrom, $lte: dateTo },
      }).sort({ date: 1 }).lean().exec();
      return { count: analytics.length, analytics };
    });
    return okContent(result, { label: `Analytics ${domain} (${dateFrom} → ${dateTo})` });
  }));
}
