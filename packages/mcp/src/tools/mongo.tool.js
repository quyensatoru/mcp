import { z } from 'zod';
import { okContent, errorContent } from '../helpers/format.helper.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { COLLECTION_WHITELIST } from '../helpers/validate.helper.js';
import { getShardConns, resolveConn } from '../services/shard-resolver.service.js';
import { mongoService } from '../services/mongo.service.js';
import { getShopModel } from '../models/api/shop.model.js';
import { getRecorderShopModel } from '../models/recorder/shop.model.js';

const MONGO_TTL = 120; // 2 phút

function wrap(name, fn) {
    return async (args) => {
        try {
            return await fn(args);
        } catch (err) {
            return errorContent(
                `${name} lỗi: ${err.message}`,
                'Kiểm tra domain, collection whitelist và cấu hình DB URI.',
            );
        }
    };
}

export function registerMongoTools(server) {
    // ── Group A: Resolve & shop ────────────────────────────────────────────────

    server.registerTool(
        'mongo_resolve_field',
        {
            title: 'Mongo resolve collection',
            description:
                'Bước đầu tiên cho tool call find db. Dùng để lấy ra field trong collection. Dựa vào đó có để quyết định query filter theo field nào',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain, vd: "mystore.myshopify.com"'),
                db: z.enum(['api', 'heatmap', 'recorder']).describe('Database cần query'),
                collection: z.string().describe(
                    `Collection name. Whitelist: ${Object.entries(COLLECTION_WHITELIST)
                        .map(([k, v]) => `${k}: [${v.join(',')}]`)
                        .join(' | ')}`,
                ),
            }),
        },
        wrap('mongo_resolve_field', async ({ domain, db, collection }) => {
            const key = cacheKey('mongo_resolve_field', { domain, db, collection });
            const result = await withCache(key, MONGO_TTL, async () => {
                const fields = await mongoService.getFields({ domain, db, collection });
                return { field: fields };
            });
            return okContent(result, { label: `Shop: ${domain}` });
        }),
    );

    server.registerTool(
        'mongo_resolve_shop',
        {
            title: 'Mongo Resolve Shop',
            description:
                'Bước 0 của mọi RCA theo shop. Tra cứu shard từ Proxy, đọc thông tin Shop (api): status, plan, quota, embed_block, started. Access token bị redact.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain, vd: "mystore.myshopify.com"'),
            }),
        },
        wrap('mongo_resolve_shop', async ({ domain }) => {
            const key = cacheKey('mongo_resolve_shop', { domain });
            const result = await withCache(key, MONGO_TTL, async () => {
                const { api, shardNum } = await getShardConns(domain);
                const Shop = getShopModel(api);
                const shop = await Shop.findOne({ domain }).lean().exec();
                if (!shop) return { found: false, domain, shardNum };
                const { access_token: _, ...safe } = shop;
                return { found: true, shardNum, shop: safe };
            });
            return okContent(result, { label: `Shop: ${domain}` });
        }),
    );

    server.registerTool(
        'mongo_shop_health',
        {
            title: 'Mongo Shop Health',
            description:
                'Kiểm tra shop tồn tại ở api, recorder không. So sánh session_count (field) với đếm thực tế.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('mongo_shop_health', async ({ domain }) => {
            const key = cacheKey('mongo_shop_health', { domain });
            const result = await withCache(key, MONGO_TTL, async () => {
                const { api, recorder, shardNum } = await getShardConns(domain);
                const [apiShop, recShop] = await Promise.allSettled([
                    getShopModel(api)
                        .findOne(
                            { domain },
                            { domain: 1, status: 1, session_count: 1, plan_code: 1, proxy: 1 },
                        )
                        .lean()
                        .exec(),
                    recorder
                        ? getRecorderShopModel(recorder)
                              .findOne({ domain }, { domain: 1, status: 1, session_count: 1 })
                              .lean()
                              .exec()
                        : null,
                ]);
                const apiDoc = apiShop.status === 'fulfilled' ? apiShop.value : null;
                const recDoc = recShop.status === 'fulfilled' ? recShop.value : null;

                let sessionCountApi = null;
                if (apiDoc?._id) {
                    sessionCountApi = await api
                        .collection('sessions')
                        .countDocuments({ shop: apiDoc._id }, { maxTimeMS: 5000 });
                }

                return {
                    shardNum,
                    api: apiDoc
                        ? {
                              exists: true,
                              status: apiDoc.status,
                              plan_code: apiDoc.plan_code,
                              session_count_field: apiDoc.session_count,
                              session_count_actual: sessionCountApi,
                          }
                        : { exists: false },
                    recorder: recDoc
                        ? { exists: true, session_count_field: recDoc.session_count }
                        : { exists: false },
                    drift:
                        apiDoc && recDoc
                            ? Math.abs((apiDoc.session_count ?? 0) - (recDoc.session_count ?? 0))
                            : null,
                };
            });
            return okContent(result, { label: `Shop health: ${domain}` });
        }),
    );

    // ── Group B: Generic read ─────────────────────────────────────────────────

    server.registerTool(
        'mongo_find',
        {
            title: 'Mongo Find',
            description:
                'Đọc documents từ bất kỳ collection nào trong whitelist. domain tự động resolve shard. Trước khi đặt filter/projection/sort, gọi mongo_resolve_field để biết field thật của collection.',
            inputSchema: z.object({
                db: z.enum(['api', 'heatmap', 'recorder']).describe('Database cần query'),
                collection: z.string().describe(
                    `Collection name. Whitelist: ${Object.entries(COLLECTION_WHITELIST)
                        .map(([k, v]) => `${k}: [${v.join(',')}]`)
                        .join(' | ')}`,
                ),
                filter: z.record(z.unknown()).default({}).describe('MongoDB filter object'),
                projection: z
                    .record(z.number())
                    .default({})
                    .describe('Fields để include (1) hoặc exclude (0)'),
                sort: z.record(z.number()).default({}).describe('Sort, vd: { createdAt: -1 }'),
                limit: z.number().int().min(1).max(200).default(20),
                domain: z.string().optional().describe('Shopify domain để auto-resolve shard'),
            }),
        },
        wrap('mongo_find', async (args) => {
            const key = cacheKey('mongo_find', args);
            const docs = await withCache(key, MONGO_TTL, () => mongoService.find(args));
            return okContent(
                { count: docs.length, docs },
                { label: `${args.db}.${args.collection} (${docs.length})` },
            );
        }),
    );

    server.registerTool(
        'mongo_aggregate',
        {
            title: 'Mongo Aggregate',
            description:
                'Chạy aggregation pipeline đọc-only. Chặn $out, $merge, $function, $where. Trước khi tham chiếu field trong pipeline, gọi mongo_resolve_field để biết field thật của collection.',
            inputSchema: z.object({
                db: z.enum(['api', 'heatmap', 'recorder']),
                collection: z.string(),
                pipeline: z.array(z.record(z.unknown())).describe('Aggregation pipeline stages'),
                domain: z.string().optional(),
            }),
        },
        wrap('mongo_aggregate', async (args) => {
            const key = cacheKey('mongo_aggregate', args);
            const result = await withCache(key, MONGO_TTL, () => mongoService.aggregate(args));
            return okContent(
                { count: result.length, result },
                { label: `Aggregate ${args.db}.${args.collection}` },
            );
        }),
    );

    server.registerTool(
        'mongo_count',
        {
            title: 'Mongo Count',
            description:
                'Đếm nhanh documents. Không filter = estimatedDocumentCount (nhanh). Có filter = countDocuments (chính xác). Khi đếm có filter, gọi mongo_resolve_field trước để chắc chắn field tồn tại.',
            inputSchema: z.object({
                db: z.enum(['api', 'heatmap', 'recorder']),
                collection: z.string(),
                filter: z.record(z.unknown()).default({}),
                domain: z.string().optional(),
            }),
        },
        wrap('mongo_count', async (args) => {
            const key = cacheKey('mongo_count', args);
            const count = await withCache(key, MONGO_TTL, () => mongoService.count(args));
            return okContent({ count, db: args.db, collection: args.collection });
        }),
    );
}
