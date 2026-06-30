import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { SessionService } from '../../services/api/session.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent, abbreviate, maskEmail } from '../../helpers/format.helper.js';
import { dateRangeFilter } from '../../helpers/validate.helper.js';
import { toObjectId } from '../../helpers/objectid.helper.js';
import { wrap } from '../../helpers/tool.helper.js';

const TTL = 120;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function formatSessionList(sessions, domain) {
    if (!sessions.length) return `No sessions match the filter for ${domain}.`;
    const rows = sessions.map((s, i) => {
        const flags = [s.frustrated && 'frustrated', s.status === false && 'open'].filter(Boolean);
        const head = `${i + 1}. ${s.device ?? '?'}/${s.browser ?? '?'} · ${s.location ?? '?'} · ${s.duration ?? 0}s · ${s.page_per_session ?? 0}pv${flags.length ? ` · ${flags.join(',')}` : ''}`;
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
        `  customer: ${maskEmail(session.customer_email)}`,
        '',
        `Counts: ${counts.pageviews} pageviews · ${counts.events} rrweb events · ${counts.behaviors} behaviors`,
    ];
    if (visitor)
        lines.push(
            `Visitor: ${visitor._id} · ${visitor.device ?? '?'} · ${visitor.location ?? '?'}`,
        );
    if (pageviews.length) {
        lines.push('', 'Pageviews:');
        pageviews.forEach((p, i) =>
            lines.push(
                `  ${i + 1}. [${p.page_type ?? '?'}] ${abbreviate(p.href, 70)} (${p.theme_template ?? '—'})`,
            ),
        );
    }
    if (flags.length) lines.push('', 'Flags:', ...flags.map((f) => `  ⚠️ ${f}`));
    return lines.join('\n');
}

function formatPageviewList(pageviews, sessionId) {
    if (!pageviews.length) return `No pageviews found for session ${sessionId}.`;
    const rows = pageviews.map((p, i) => {
        const status = p.status ? 'closed' : 'open';
        const duration =
            p.start_time && p.end_time
                ? `${Math.round((new Date(p.end_time) - new Date(p.start_time)) / 1000)}s`
                : '—';
        return [
            `${i + 1}. [${p.page_type ?? '?'}] ${abbreviate(p.href, 80)}`,
            `   id: ${p._id} · ${p.theme_template ?? '—'} · ${p.width ?? '?'}x${p.height ?? '?'} · ${status} · ${duration}`,
        ].join('\n');
    });
    return [`${pageviews.length} pageviews — session ${sessionId}:`, '', ...rows].join('\n');
}

function formatPageviewDetail(pv) {
    if (!pv) return 'Pageview not found.';
    const duration =
        pv.start_time && pv.end_time
            ? `${Math.round((new Date(pv.end_time) - new Date(pv.start_time)) / 1000)}s`
            : '—';
    return [
        `PageView ${pv._id}`,
        `  url: ${pv.href ?? '—'}`,
        `  type: ${pv.page_type ?? '—'} · template: ${pv.theme_template ?? '—'}`,
        `  viewport: ${pv.width ?? '?'}x${pv.height ?? '?'} · status: ${pv.status ? 'closed' : 'open'}`,
        `  duration: ${duration} · start: ${pv.start_time ?? '—'} end: ${pv.end_time ?? '—'}`,
        `  session: ${pv.session ?? '—'} · page: ${pv.page ?? '—'}`,
        `  createdAt: ${pv.createdAt ? new Date(pv.createdAt).toISOString() : '—'}`,
    ].join('\n');
}

function formatPageList(pages, domain) {
    if (!pages.length) return `No pages match for ${domain}.`;
    const rows = pages.map(
        (p, i) =>
            `${i + 1}. ${p.title ?? '(no title)'} · hm:${p.hmEnabled ? 'on' : 'off'}\n   ${abbreviate(p.address, 80)}`,
    );
    return [`${pages.length} pages — ${domain}:`, '', ...rows].join('\n');
}

function formatBehaviorEvents(behaviors) {
    if (!behaviors.length) return 'No behavior events.';
    const rows = behaviors.map((b, i) => {
        const data = b.data ? abbreviate(JSON.stringify(b.data), 100) : '';
        return `${i + 1}. [${b.type ?? '?'}]${b.funnels?.length ? ` funnels=${b.funnels.join(',')}` : ''} ${data}`;
    });
    return [`${behaviors.length} behavior events:`, '', ...rows].join('\n');
}

function formatSessionMissing(missing, domain) {
    if (!missing.length) return `No missing sessions for ${domain}.`;
    const rows = missing.map(
        (s, i) =>
            `${i + 1}. ${s.device ?? '?'}/${s.browser ?? '?'} · ${s.location ?? '?'} · ip:${s.ip ?? '—'} · ${s.createdAt ? new Date(s.createdAt).toISOString() : '—'}`,
    );
    return [
        `${missing.length} missing sessions — ${domain}:`,
        '(Sessions dropped before reaching the API — usually due to quota exceeded)',
        '',
        ...rows,
    ].join('\n');
}

export function registerSessionTools(server) {
    server.registerTool(
        'session_list',
        {
            title: 'Session List',
            description:
                'List recorded sessions filtered by device, location, or date range. Use to find specific sessions to inspect — e.g. frustrated users or a given customer\'s visits.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                device: z
                    .enum(['Desktop', 'Mobile', 'Tablet'])
                    .optional()
                    .describe('Filter by device type'),
                location: z
                    .string()
                    .optional()
                    .describe('Filter by location (country/region string)'),
                dateFrom: z.string().optional().describe('Start date YYYY-MM-DD (by createdAt)'),
                dateTo: z.string().optional().describe('End date YYYY-MM-DD (by createdAt)'),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(100)
                    .default(20)
                    .describe('Max sessions to return'),
            }),
        },
        wrap('session_list', async (args) => {
            const { domain, limit, ...f } = args;
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);

            const filter = { shop: shopId };

            if (f.device) filter.device = f.device;
            if (f.location) filter.location = f.location;

            const created = dateRangeFilter(f.dateFrom, f.dateTo);
            if (created) filter.createdAt = created;

            const sessions = await withCache(
                cacheKey('session_list', { proxy, filter, limit }),
                TTL,
                () => SessionService.list(proxy, filter, limit),
            );
            return textContent(formatSessionList(sessions, domain));
        }),
    );

    server.registerTool(
        'session_detail',
        {
            title: 'Session Detail',
            description:
                'Full detail of one session by id: visitor info, pageviews, counts of rrweb events & behaviors, plus pipeline flags. Use to diagnose "recording missing/broken" — the flags show where the Session → PageView → Event chain breaks.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                sessionId: z.string().optional().describe('Session ObjectId'),
            }),
        },
        wrap('session_detail', async ({ domain, sessionId }) => {
            if (!sessionId) return errorContent('Provide sessionId.');
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent('Shop not found');

            const filter = { shop: toObjectId(shopId), _id: toObjectId(sessionId) }

            const session = await SessionService.findOne(proxy, filter);
            if (!session) {
                return errorContent(`Session not found: ${sessionId}`);
            }

            const pageviews = await SessionService.pageviews(proxy, session._id);
            const pvIds = pageviews.map((p) => p._id);
            const [events, behaviors, visitor] = await Promise.all([
                SessionService.countEvents(proxy, pvIds),
                SessionService.countBehaviors(proxy, session._id),
                SessionService.visitor(proxy, session.visitor),
            ]);

            const flags = [];
            if (!pageviews.length) {
                flags.push(`Session exists but has not PageViews`);
            } else if (events === 0) {
                flags.push('PageViews exist but 0 rrweb Events');
            }

            if(behaviors === 0) {
                flags.push('Behavior not exists');
            }
                
            if (session.status === false) {
                flags.push('Session not closed (status=false)');
            }

            return textContent(
                formatSessionDetail(
                    { session, visitor, pageviews, counts: { pageviews: pageviews.length, events, behaviors }, flags },
                    domain,
                ),
            );
        }),
    );

    server.registerTool(
        'session_pageviews',
        {
            title: 'Session Pageviews',
            description:
                'List all pageviews for a session with URL, type, template, viewport, and duration. Use to inspect the page navigation path within a session, or to get pageView IDs for replay_events / behavior_events.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                sessionId: z.string().describe('Session ObjectId'),
            }),
        },
        wrap('session_pageviews', async ({ domain, sessionId }) => {
            if (!sessionId) return errorContent('Provide sessionId.');
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);

            const session = await SessionService.findOne(proxy, {
                shop: toObjectId(shopId),
                _id: toObjectId(sessionId),
            });
            if (!session) return errorContent(`Session not found: ${sessionId}`);

            const pageviews = await withCache(
                cacheKey('session_pageviews', { proxy, sessionId }),
                TTL,
                () => SessionService.pageviews(proxy, session._id),
            );
            return textContent(formatPageviewList(pageviews, sessionId));
        }),
    );

    server.registerTool(
        'pageview_detail',
        {
            title: 'Pageview Detail',
            description:
                'Full detail of a single pageview by ID: URL, page type, template, viewport size, open/closed status, and timing. Use before querying replay_events or behavior_events to confirm the pageview exists and has the expected data.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                pageViewId: z.string().describe('PageView ObjectId'),
            }),
        },
        wrap('pageview_detail', async ({ domain, pageViewId }) => {
            if (!pageViewId) return errorContent('Provide pageViewId.');
            const proxy = await resolveProxy(domain);
            const pv = await withCache(
                cacheKey('pageview_detail', { proxy, pageViewId }),
                TTL,
                () => SessionService.pageviewDetail(proxy, pageViewId),
            );
            return textContent(formatPageviewDetail(pv));
        }),
    );

    server.registerTool(
        'session_missing',
        {
            title: 'Session Missing',
            description:
                'List sessions dropped by the recorder before reaching the API — typically because the shop exceeded its plan session_limit. Returns records from the recorder\'s sessionmissings collection. Use to confirm quota is the cause of "missing recordings".',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                dateFrom: z.string().optional().describe('Start date YYYY-MM-DD'),
                dateTo: z.string().optional().describe('End date YYYY-MM-DD'),
                limit: z.number().int().min(1).max(200).default(50).describe('Max records to return'),
            }),
        },
        wrap('session_missing', async ({ domain, dateFrom, dateTo, limit }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);

            const missing = await withCache(
                cacheKey('session_missing', { proxy, shopId, dateFrom, dateTo, limit }),
                TTL,
                () => SessionService.missing(proxy, shopId, dateFrom, dateTo, limit),
            );
            return textContent(formatSessionMissing(missing, domain));
        }),
    );

    server.registerTool(
        'page_list',
        {
            title: 'Page List',
            description:
                'Find pages by title or address, with heatmap-enabled flag. Use to locate a page id before querying heatmaps, or to check which pages have heatmap tracking on.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                q: z.string().optional().describe('Keyword matched against page title or address'),
                limit: z.number().int().min(1).max(100).default(20).describe('Max pages to return'),
            }),
        },
        wrap('page_list', async ({ domain, q, limit }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);

            const filter = { shop: shopId };
            if (q) {
                const rx = new RegExp(escapeRegex(q), 'i');
                filter.$or = [{ title: rx }, { address: rx }];
            }
            const pages = await withCache(
                cacheKey('page_list', { proxy, shopId, q, limit }),
                TTL,
                () => SessionService.pages(proxy, filter, limit),
            );
            return textContent(formatPageList(pages, domain));
        }),
    );

    server.registerTool(
        'behavior_events',
        {
            title: 'Behavior Events',
            description:
                'Behavior events (cart, funnel, UX issues) for a session or a pageview. Use to inspect what actions a user took, or to diagnose cart/checkout funnel behavior at the event level.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                sessionId: z
                    .string()
                    .optional()
                    .describe('Session ObjectId (all behaviors of the session)'),
                pageViewId: z
                    .string()
                    .optional()
                    .describe('PageView ObjectId (behaviors of one pageview)'),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(200)
                    .default(50)
                    .describe('Max events to return'),
            }),
        },
        wrap('behavior_events', async ({ domain, sessionId, pageViewId, limit }) => {
            if (!sessionId && !pageViewId) return errorContent('Provide sessionId or pageViewId.');
            const proxy = await resolveProxy(domain);
            const filter = pageViewId
                ? { pageView: toObjectId(pageViewId) }
                : { session: toObjectId(sessionId) };
            const behaviors = await SessionService.behaviors(proxy, filter, limit);
            return textContent(formatBehaviorEvents(behaviors));
        }),
    );
}
