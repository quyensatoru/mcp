import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent, abbreviate, maskEmail, formatSessionList, formatSessionDetail } from '../../helpers/format.helper.js';
import { dateRangeFilter } from '../../helpers/validate.helper.js';
import { toObjectId } from '../../helpers/objectid.helper.js';
import { wrap } from '../../helpers/tool.helper.js';
import { RecorderSessionService } from '../../services/recorder/session.service.js';

const TTL = 120;

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

export function registerSessionRecorderTools(server) {
    server.registerTool(
        'recorder_get_sessions',
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
        wrap('recorder_get_sessions', async (args) => {
            const { domain, limit, ...f } = args;
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);

            if (!shopId) {
                return errorContent(`Shop not found: ${domain}`);
            }

            const filter = { shop: shopId };

            if (f.device) filter.device = f.device;
            if (f.location) filter.location = f.location;

            const created = dateRangeFilter(f.dateFrom, f.dateTo);
            if (created) filter.createdAt = created;

            const sessions = await withCache(
                cacheKey('recorder_get_sessions', { proxy, filter, limit }),
                TTL,
                () => RecorderSessionService.list(proxy, filter, limit),
            );
            return textContent(formatSessionList(sessions, domain, 'Recorder'));
        }),
    );

    server.registerTool(
        'recorder_get_session_detail',
        {
            title: 'Session Detail',
            description:
                'Full detail of one session by id: visitor info, pageviews, counts of rrweb events & behaviors, plus pipeline flags. Use to diagnose "recording missing/broken" — the flags show where the Session → PageView → Event chain breaks.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                sessionId: z.string().optional().describe('Session ObjectId'),
            }),
        },
        wrap('recorder_get_session_detail', async ({ domain, sessionId }) => {
            if (!sessionId) return errorContent('Provide sessionId.');
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) {
                return errorContent('Shop not found');
            }

            const filter = { 
                shop: toObjectId(shopId), 
                _id: toObjectId(sessionId) 
            }

            const session = await RecorderSessionService.findOne(proxy, filter);
            if (!session) {
                return errorContent(`Session not found: ${sessionId}`);
            }

            return textContent(
                formatSessionDetail(
                    { 
                        session,
                    },
                    domain,
                    'Recorder'
                ),
            );
        }),
    );

    server.registerTool(
        'recorder_get_session_missing',
        {
            title: 'Session Missing',
            description:
                'List sessions dropped by the recorder — typically because the shop exceeded its plan session_limit. Returns records from the recorder\'s sessionmissings collection. Use to confirm quota is the cause of "missing recordings".',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                dateFrom: z.string().optional().describe('Start date YYYY-MM-DD'),
                dateTo: z.string().optional().describe('End date YYYY-MM-DD'),
                limit: z.number().int().min(1).max(200).default(50).describe('Max records to return'),
            }),
        },
        wrap('recorder_get_session_missing', async ({ domain, dateFrom, dateTo, limit }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);

            if (!shopId) {
                return errorContent(`Shop not found: ${domain}`);
            }

            const missing = await withCache(
                cacheKey('recorder_get_session_missing', { proxy, shopId, dateFrom, dateTo, limit }),
                TTL,
                () => RecorderSessionService.missing(proxy, shopId, dateFrom, dateTo, limit),
            );
            return textContent(formatSessionMissing(missing, domain));
        }),
    );
}
