import { z } from 'zod';
import { okContent, errorContent } from '../helpers/format.helper.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { replicaCompareService } from '../services/replica-compare.service.js';

const INTEGRITY_TTL = 60;

function wrap(name, fn) {
    return async (args) => {
        try {
            return await fn(args);
        } catch (err) {
            return errorContent(`${name}: ${err.message}`);
        }
    };
}

export function registerMongoIntegrityTools(server) {
    server.registerTool(
        'mongo_compare_replica',
        {
            title: 'Mongo Compare Replica',
            description:
                'So sánh document giữa api (nguồn) ↔ recorder. Phát hiện MISSING (recorder không có) hoặc STALE (lệch fields). Khi phát hiện drift → chạy loki_queue_health để xác nhận nguyên nhân.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                entity: z.enum(['session', 'shop']).describe('Loại entity cần so sánh'),
                id: z.string().optional().describe('ObjectId (bắt buộc cho session)'),
            }),
        },
        wrap('mongo_compare_replica', async ({ domain, entity, id }) => {
            const key = cacheKey('mongo_compare_replica', { domain, entity, id });
            const result = await withCache(key, INTEGRITY_TTL, async () => {
                if (entity === 'session') {
                    if (!id) throw new Error('id (sessionId) là bắt buộc cho entity=session');
                    return replicaCompareService.compareSession(domain, id);
                }
                return replicaCompareService.compareShop(domain);
            });
            return okContent(result, { label: `Replica compare: ${entity} (${result.status})` });
        }),
    );

    server.registerTool(
        'mongo_missing_report',
        {
            title: 'Mongo Missing Report',
            description:
                'Đọc sessionMissing + analytic_missing từ Recorder — những gì hệ thống tự đánh dấu là thiếu. Dấu hiệu trực tiếp của việc đạt quá giới hạn quota record session.',
            inputSchema: z.object({
                domain: z.string(),
                dateFrom: z.string().optional().describe('YYYY-MM-DD'),
                dateTo: z.string().optional().describe('YYYY-MM-DD'),
            }),
        },
        wrap('mongo_missing_report', async ({ domain, dateFrom, dateTo }) => {
            const key = cacheKey('mongo_missing_report', { domain, dateFrom, dateTo });
            const result = await withCache(key, INTEGRITY_TTL, () =>
                replicaCompareService.missingReport(domain, dateFrom, dateTo),
            );
            return okContent(result, { label: `Missing report: ${domain}` });
        }),
    );

    server.registerTool(
        'mongo_replica_lag',
        {
            title: 'Mongo Replica Lag',
            description:
                'Ước lượng độ trễ replica: so last_active mới nhất ở api vs recorder. Lag > 5min = cờ đỏ.',
            inputSchema: z.object({
                domain: z.string(),
            }),
        },
        wrap('mongo_replica_lag', async ({ domain }) => {
            const result = await replicaCompareService.replicaLag(domain);
            return okContent(result, {
                label: `Replica lag: ${domain} — ${result.lag_human ?? 'unknown'}`,
            });
        }),
    );
}
