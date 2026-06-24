import { z } from 'zod';
import { resolveProxy } from '../services/proxy.service.js';
import { ShopService } from '../services/shop.service.js';
import { RecordingService } from '../services/recording.service.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { textContent, errorContent } from '../helpers/format.helper.js';
import { wrap } from '../helpers/tool.helper.js';

const TTL = 60;

function lagStatus(lagMs) {
    if (lagMs == null) return 'unknown';
    if (lagMs > 300000) return `${Math.round(lagMs / 1000)}s ⚠️ >5min`;
    if (lagMs > 60000) return `${Math.round(lagMs / 1000)}s ⚠️ >1min`;
    return `${Math.round(lagMs / 1000)}s ✓`;
}

function formatIntegrity(data, domain, proxy) {
    const { counts, lag, session } = data;
    const drift =
        counts.apiCount != null && counts.recorderCount != null
            ? Math.abs(counts.apiCount - counts.recorderCount)
            : '—';
    const lines = [
        `Recording integrity — ${domain} (shard ${proxy})`,
        `  Shop session_count: api=${counts.apiCount ?? '—'} recorder=${counts.recorderCount ?? (counts.recorderExists ? 0 : 'NOT_FOUND')} (drift=${drift})`,
        `  Replica lag: ${lagStatus(lag.lagMs)}  [api=${lag.apiLatest ? new Date(lag.apiLatest).toISOString() : '—'} rec=${lag.recorderLatest ? new Date(lag.recorderLatest).toISOString() : '—'}]`,
    ];
    if (session) {
        lines.push('', `Session ${session.sessionId}: ${session.status}`);
        if (session.diffs?.length)
            session.diffs.forEach((d) => lines.push(`  - ${d.field}: api=${JSON.stringify(d.api)} rec=${JSON.stringify(d.replica)}`));
    }
    return lines.join('\n');
}

function formatMissing(data, shop, domain) {
    const { sessionMissing, analyticMissing } = data;
    const limit = shop?.subscription_info?.session_limit ?? null;
    const used = shop?.session_count ?? null;
    const overQuota = limit != null && used != null && used >= limit;
    const diagnosis = sessionMissing.length || analyticMissing.length
        ? `${sessionMissing.length} sessions + ${analyticMissing.length} days marked missing → likely over quota. session_count=${used ?? '—'} / session_limit=${limit ?? '—'} (${overQuota ? 'OVER limit' : 'under limit'}).`
        : 'No missing records → shop has not hit its quota limit.';
    const lines = [
        `Recording missing — ${domain}`,
        `  ${diagnosis}`,
        '',
        `Session missing (${sessionMissing.length}):`,
        ...sessionMissing.slice(0, 10).map((s, i) => `  ${i + 1}. ${s.device ?? '?'}/${s.browser ?? '?'} · ${s.location ?? '?'} · ${s.createdAt ? new Date(s.createdAt).toISOString() : '—'}`),
        '',
        `Analytic missing (${analyticMissing.length}):`,
        ...analyticMissing.slice(0, 10).map((a) => `  ${a.date ? new Date(a.date).toISOString().slice(0, 10) : '—'}: ${a.count_session ?? 0} sessions`),
    ];
    return lines.join('\n');
}

export function registerRecordingTools(server) {
    server.registerTool(
        'recording_integrity',
        {
            title: 'Recording Integrity',
            description:
                'Compare api (source) vs recorder (replica): session_count drift + replica lag. Pass sessionId to compare one session in detail (MISSING/STALE/IN_SYNC). Use when recorder/replica data looks out of sync with api.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                sessionId: z.string().optional().describe('Session ObjectId for a detailed per-session compare'),
            }),
        },
        wrap('recording_integrity', async ({ domain, sessionId }) => {
            const data = await withCache(cacheKey('recording_integrity', { domain, sessionId }), TTL, async () => {
                const proxy = await resolveProxy(domain);
                const shopId = await ShopService.idByDomain(proxy, domain);
                if (!shopId) return { proxy, missing: true };
                const [counts, lag, session] = await Promise.all([
                    RecordingService.compareShopCounts(proxy, domain),
                    RecordingService.replicaLag(proxy, shopId),
                    sessionId ? RecordingService.compareSession(proxy, sessionId) : null,
                ]);
                return { proxy, counts, lag, session };
            });
            if (data.missing) return errorContent(`Shop not found: ${domain}`);
            return textContent(formatIntegrity(data, domain, data.proxy));
        }),
    );

    server.registerTool(
        'recording_missing',
        {
            title: 'Recording Missing',
            description:
                'Reads sessionmissings + analytic_missing (recorder): sessions dropped because the shop exceeded its plan session_limit (a quota feature, NOT a consumer/queue error). Use to explain "sessions not recorded" when quota is the suspected cause.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                dateFrom: z.string().optional().describe('Start date YYYY-MM-DD'),
                dateTo: z.string().optional().describe('End date YYYY-MM-DD'),
            }),
        },
        wrap('recording_missing', async ({ domain, dateFrom, dateTo }) => {
            const proxy = await resolveProxy(domain);
            const shop = await ShopService.findByDomain(proxy, domain);
            if (!shop) return errorContent(`Shop not found: ${domain}`);
            const data = await withCache(cacheKey('recording_missing', { domain, dateFrom, dateTo }), TTL, () =>
                RecordingService.missing(proxy, shop._id, dateFrom, dateTo),
            );
            return textContent(formatMissing(data, shop, domain));
        }),
    );
}
