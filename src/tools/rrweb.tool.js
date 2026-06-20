import { z } from 'zod';
import mongoose from 'mongoose';
import { okContent, errorContent, toText } from '../helpers/format.helper.js';
import { imageContent, diffImages, toBase64 } from '../helpers/image.helper.js';
import { getShardConns } from '../services/shard-resolver.service.js';
import { getEventModel } from '../models/api/event.model.js';
import { getPageViewModel } from '../models/api/pageview.model.js';
import { getSessionModel } from '../models/api/session.model.js';
import { rrwebService } from '../services/rrweb.service.js';
import { screenshotService } from '../services/screenshot.service.js';

const ObjectId = mongoose.Types.ObjectId;
function tryId(s) { try { return new ObjectId(s); } catch { return null; } }

function wrap(name, fn) {
  return async (args) => {
    try { return await fn(args); }
    catch (err) { return errorContent(`${name}: ${err.message}`, 'Kiểm tra domain, sessionId/pageViewId và đảm bảo Playwright/Chromium đã được cài (npx playwright install chromium).'); }
  };
}

export function registerRrwebTools(server) {
  server.registerTool('rrweb_list', {
    title: 'rrweb List',
    description: 'Liệt kê các PageView có rrweb Events khả dụng để replay, theo session hoặc khoảng thời gian.',
    inputSchema: z.object({
      domain: z.string(),
      sessionId: z.string().optional(),
      start: z.string().optional().describe('ISO date từ'),
      end: z.string().optional().describe('ISO date đến'),
      limit: z.number().int().min(1).max(50).default(20),
    }),
  }, wrap('rrweb_list', async ({ domain, sessionId, start, end, limit }) => {
    const { api } = await getShardConns(domain);
    const PageView = getPageViewModel(api);
    const Event = getEventModel(api);

    const pvFilter = {};
    if (sessionId) pvFilter.session = tryId(sessionId);
    if (start || end) {
      pvFilter.createdAt = {};
      if (start) pvFilter.createdAt.$gte = new Date(start);
      if (end) pvFilter.createdAt.$lte = new Date(end);
    }
    const pageviews = await PageView.find(pvFilter, { href: 1, session: 1, page: 1, start_time: 1, createdAt: 1 })
      .sort({ createdAt: -1 }).limit(limit).lean().exec();

    const pvIds = pageviews.map(p => p._id);
    const eventCounts = await Event.aggregate([
      { $match: { pageView: { $in: pvIds } } },
      { $group: { _id: '$pageView', count: { $sum: 1 } } },
    ]).exec();
    const countMap = Object.fromEntries(eventCounts.map(e => [e._id.toString(), e.count]));

    const list = pageviews
      .map(p => ({ ...p, eventCount: countMap[p._id.toString()] ?? 0 }))
      .filter(p => p.eventCount > 0);

    return okContent({ count: list.length, pageviews: list }, { label: `rrweb list: ${list.length} pageviews with events` });
  }));

  server.registerTool('rrweb_render', {
    title: 'rrweb Render',
    description: 'Render rrweb session replay từ MongoDB Events, chụp screenshot tại mốc thời gian. Trả về ảnh PNG.',
    inputSchema: z.object({
      domain: z.string(),
      pageViewId: z.string().describe('ObjectId của PageView để render'),
      atMs: z.number().optional().describe('Mốc thời gian ms kể từ đầu replay (null = cuối)'),
      eventLimit: z.number().int().min(100).max(5000).default(1000),
    }),
  }, wrap('rrweb_render', async ({ domain, pageViewId, atMs, eventLimit }) => {
    const { api } = await getShardConns(domain);
    const Event = getEventModel(api);
    const events = await Event.find({ pageView: tryId(pageViewId) })
      .sort({ timestamp: 1 }).limit(eventLimit).lean({ getters: true }).exec();

    if (!events.length) return errorContent(`Không có events cho pageView ${pageViewId}`);

    const rrwebEvents = events.map(e => ({ type: e.type, timestamp: e.timestamp, data: e.data }));
    const { buffer, seekMs, totalDuration, errors } = await rrwebService.render(rrwebEvents, { atMs });

    return {
      content: [
        imageContent(buffer, `rrweb replay at ${seekMs}ms`),
        {
          type: 'text',
          text: toText({ pageViewId, eventCount: events.length, seekMs, totalDuration, renderErrors: errors }),
        },
      ],
    };
  }));

  server.registerTool('screenshot_url', {
    title: 'Screenshot URL',
    description: 'Chụp screenshot website thật (storefront, page cụ thể) dùng Playwright. Dùng để so sánh với rrweb replay.',
    inputSchema: z.object({
      url: z.string().url().describe('URL cần chụp'),
      width: z.number().int().default(1280),
      height: z.number().int().default(800),
      waitFor: z.enum(['load', 'networkidle']).default('networkidle'),
    }),
  }, wrap('screenshot_url', async ({ url, width, height, waitFor }) => {
    const { buffer, title, consoleErrors } = await screenshotService.capture(url, {
      viewport: { width, height },
      waitFor,
    });
    return {
      content: [
        imageContent(buffer, `Screenshot: ${url}`),
        { type: 'text', text: toText({ url, title, consoleErrors }) },
      ],
    };
  }));

  server.registerTool('rrweb_diagnose', {
    title: 'rrweb Diagnose',
    description: 'So sánh rrweb replay snapshot ↔ live website: render cả hai, tính pixelmatch diff. Để AI suy luận lỗi hiển thị/JS. Trả về 3 ảnh: replay, live, diff.',
    inputSchema: z.object({
      domain: z.string(),
      pageViewId: z.string().describe('ObjectId của PageView'),
      compareUrl: z.string().url().describe('URL website thật để chụp so sánh'),
      atMs: z.number().optional(),
      eventLimit: z.number().int().min(100).max(5000).default(1000),
    }),
  }, wrap('rrweb_diagnose', async ({ domain, pageViewId, compareUrl, atMs, eventLimit }) => {
    const { api } = await getShardConns(domain);
    const Event = getEventModel(api);
    const events = await Event.find({ pageView: tryId(pageViewId) })
      .sort({ timestamp: 1 }).limit(eventLimit).lean({ getters: true }).exec();

    if (!events.length) return errorContent(`Không có events cho pageView ${pageViewId}`);

    const rrwebEvents = events.map(e => ({ type: e.type, timestamp: e.timestamp, data: e.data }));

    // Render cả hai song song
    const [replayResult, liveResult] = await Promise.all([
      rrwebService.render(rrwebEvents, { atMs }),
      screenshotService.capture(compareUrl, { viewport: { width: 1280, height: 800 } }),
    ]);

    // Diff
    const { diffBuffer, diffPercent, diffPixels, totalPixels } = diffImages(replayResult.buffer, liveResult.buffer);

    const diagnosis = diffPercent > 30
      ? '🔴 Khác biệt lớn (>30%) — có thể CSS/JS load lỗi hoặc layout vỡ'
      : diffPercent > 10
        ? '🟡 Khác biệt đáng chú ý (10-30%) — có thể nội dung dynamic khác'
        : '🟢 Rất giống nhau (<10%) — UI hiển thị bình thường';

    return {
      content: [
        imageContent(replayResult.buffer, 'rrweb Replay'),
        imageContent(liveResult.buffer, 'Live Website'),
        imageContent(diffBuffer, `Diff (${diffPercent}% changed)`),
        {
          type: 'text',
          text: toText({
            diffPercent, diffPixels, totalPixels, diagnosis,
            replayErrors: replayResult.errors,
            liveConsoleErrors: liveResult.consoleErrors,
            seekMs: replayResult.seekMs,
            liveUrl: liveResult.url,
          }),
        },
      ],
    };
  }));
}
