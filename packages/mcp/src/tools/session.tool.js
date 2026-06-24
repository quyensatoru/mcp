import { z } from 'zod';
import { resolveProxy } from '../services/proxy.service.js';
import { ShopService } from '../services/shop.service.js';
import { SessionService } from '../services/session.service.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { textContent, errorContent, abbreviate, maskEmail } from '../helpers/format.helper.js';
import { dateRangeFilter } from '../helpers/validate.helper.js';
import { toObjectId } from '../helpers/objectid.helper.js';
import { replayLink, heatmapLink, mdLink } from '../helpers/url.helper.js';
import { wrap } from '../helpers/tool.helper.js';

const TTL = 120;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function formatSessionList(sessions, domain) {
    if (!sessions.length) return `Không có session khớp filter cho ${domain}.`;
    const rows = sessions.map((s, i) => {
        const flags = [s.frustrated && 'frustrated', s.status === false && 'open'].filter(Boolean);
        const head = `${i + 1}. ${s.device ?? '?'}/${s.browser ?? '?'} · ${s.location ?? '?'} · ${s.duration ?? 0}s · ${s.page_per_session ?? 0}pv${flags.length ? ` · ${flags.join(',')}` : ''} — ${mdLink('View Replay', replayLink(s._id))}`;
        const sub = `   key: ${s.key ?? '—'} · ${maskEmail(s.customer_email)} · ${s.last_active ? new Date(s.last_active).toISOString() : '—'}`;
        return `${head}\n${sub}`;
    });
    return [`${sessions.length} sessions — ${domain}:`, '', ...rows].join('\n');
}

function formatSessionDetail(data, domain) {
    const { session, visitor, pageviews, counts, flags } = data;
    const lines = [
        `Session ${session.key ?? session._id} — ${domain}`,
        `  device: ${session.device ?? '?'}/${session.browser ?? '?'}/${session.os ?? '?'} · ${session.location ?? '?'}`,
        `  duration: ${session.duration ?? 0}s (active ${session.active_duration ?? 0}s) · pages: ${counts.pageviews} · status: ${session.status ? 'closed' : 'open'}`,
        `  frustrated: ${session.frustrated ? 'yes' : 'no'} · clicks: ${session.click_count ?? 0} · last_active: ${session.last_active ? new Date(session.last_active).toISOString() : '—'}`,
        `  customer: ${maskEmail(session.customer_email)} · ${mdLink('View Replay', replayLink(session._id))}`,
        '',
        `Counts: ${counts.pageviews} pageviews · ${counts.events} rrweb events · ${counts.behaviors} behaviors`,
    ];
    if (visitor)
        lines.push(`Visitor: ${visitor._id} · ${visitor.device ?? '?'} · ${visitor.location ?? '?'}`);
    if (pageviews.length) {
        lines.push('', 'Pageviews:');
        pageviews.forEach((p, i) =>
            lines.push(`  ${i + 1}. [${p.page_type ?? '?'}] ${abbreviate(p.href, 70)} (${p.theme_template ?? '—'})`),
        );
    }
    if (flags.length) lines.push('', 'Flags:', ...flags.map((f) => `  ⚠️ ${f}`));
    return lines.join('\n');
}

function formatPageList(pages, domain) {
    if (!pages.length) return `Không có page khớp cho ${domain}.`;
    const rows = pages.map(
        (p, i) =>
            `${i + 1}. ${p.title ?? '(no title)'} · hm:${p.hmEnabled ? 'on' : 'off'} — ${mdLink('View Heatmap', heatmapLink(p._id))}\n   ${abbreviate(p.address, 80)}`,
    );
    return [`${pages.length} pages — ${domain}:`, '', ...rows].join('\n');
}

function formatBehaviorEvents(behaviors) {
    if (!behaviors.length) return 'Không có behavior event.';
    const rows = behaviors.map((b, i) => {
        const data = b.data ? abbreviate(JSON.stringify(b.data), 100) : '';
        return `${i + 1}. [${b.type ?? '?'}]${b.funnels?.length ? ` funnels=${b.funnels.join(',')}` : ''} ${data}`;
    });
    return [`${behaviors.length} behavior events:`, '', ...rows].join('\n');
}

export function registerSessionTools(server) {
    server.registerTool(
        'session_list',
        {
            title: 'Session List',
            description:
                'Liệt kê session theo filter (device, location, frustrated, email, ngày). Mỗi dòng kèm link replay.',
            inputSchema: z.object({
                domain: z.string(),
                device: z.enum(['Desktop', 'Mobile', 'Tablet']).optional(),
                location: z.string().optional(),
                frustrated: z.boolean().optional(),
                customer_email: z.string().optional(),
                dateFrom: z.string().optional().describe('YYYY-MM-DD theo createdAt'),
                dateTo: z.string().optional().describe('YYYY-MM-DD theo createdAt'),
                limit: z.number().int().min(1).max(100).default(20),
            }),
        },
        wrap('session_list', async (args) => {
            const { domain, limit, ...f } = args;
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop không tồn tại: ${domain}`);

            const filter = { shop: shopId };
            if (f.device) filter.device = f.device;
            if (f.location) filter.location = f.location;
            if (typeof f.frustrated === 'boolean') filter.frustrated = f.frustrated;
            if (f.customer_email) filter.customer_email = f.customer_email;
            const created = dateRangeFilter(f.dateFrom, f.dateTo);
            if (created) filter.createdAt = created;

            const sessions = await withCache(cacheKey('session_list', { proxy, filter, limit }), TTL, () =>
                SessionService.list(proxy, filter, limit),
            );
            return textContent(formatSessionList(sessions, domain));
        }),
    );

    server.registerTool(
        'session_detail',
        {
            title: 'Session Detail',
            description:
                'Chi tiết 1 session: visitor + pageviews + đếm events/behaviors + flags chỗ đứt pipeline (Session→PageView→Event).',
            inputSchema: z.object({
                domain: z.string(),
                sessionId: z.string().optional().describe('ObjectId của session'),
                sessionKey: z.string().optional().describe('session.key (UUID client)'),
            }),
        },
        wrap('session_detail', async ({ domain, sessionId, sessionKey }) => {
            if (!sessionId && !sessionKey)
                return errorContent('Cần sessionId hoặc sessionKey.');
            const proxy = await resolveProxy(domain);
            const filter = sessionId ? { _id: toObjectId(sessionId) } : { key: sessionKey };
            const session = await SessionService.findOne(proxy, filter);
            if (!session) return errorContent(`Session không tồn tại: ${sessionId ?? sessionKey}`);

            const pageviews = await SessionService.pageviews(proxy, session._id);
            const pvIds = pageviews.map((p) => p._id);
            const [events, behaviors, visitor] = await Promise.all([
                SessionService.countEvents(proxy, pvIds),
                SessionService.countBehaviors(proxy, session._id),
                SessionService.visitor(proxy, session.visitor),
            ]);

            const flags = [];
            if (!pageviews.length) flags.push('Session tồn tại nhưng 0 PageView — ingest/queue có thể lỗi');
            else if (events === 0) flags.push('Có PageView nhưng 0 Event (rrweb) — recording không gửi data hoặc consumer drop');
            if (session.status === false) flags.push('Session chưa đóng (status=false)');

            return textContent(
                formatSessionDetail(
                    { session, visitor, pageviews, counts: { pageviews: pageviews.length, events, behaviors }, flags },
                    domain,
                ),
            );
        }),
    );

    server.registerTool(
        'page_list',
        {
            title: 'Page List',
            description: 'Tìm Page theo title/address. Mỗi dòng kèm link heatmap.',
            inputSchema: z.object({
                domain: z.string(),
                q: z.string().optional().describe('Từ khoá khớp title hoặc address'),
                limit: z.number().int().min(1).max(100).default(20),
            }),
        },
        wrap('page_list', async ({ domain, q, limit }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop không tồn tại: ${domain}`);

            const filter = { shop: shopId };
            if (q) {
                const rx = new RegExp(escapeRegex(q), 'i');
                filter.$or = [{ title: rx }, { address: rx }];
            }
            const pages = await withCache(cacheKey('page_list', { proxy, shopId, q, limit }), TTL, () =>
                SessionService.pages(proxy, filter, limit),
            );
            return textContent(formatPageList(pages, domain));
        }),
    );

    server.registerTool(
        'behavior_events',
        {
            title: 'Behavior Events',
            description: 'Behavior (cart/funnel/ux) theo session hoặc pageview.',
            inputSchema: z.object({
                domain: z.string(),
                sessionId: z.string().optional(),
                pageViewId: z.string().optional(),
                limit: z.number().int().min(1).max(200).default(50),
            }),
        },
        wrap('behavior_events', async ({ domain, sessionId, pageViewId, limit }) => {
            if (!sessionId && !pageViewId)
                return errorContent('Cần sessionId hoặc pageViewId.');
            const proxy = await resolveProxy(domain);
            const filter = pageViewId
                ? { pageView: toObjectId(pageViewId) }
                : { session: toObjectId(sessionId) };
            const behaviors = await SessionService.behaviors(proxy, filter, limit);
            return textContent(formatBehaviorEvents(behaviors));
        }),
    );
}
