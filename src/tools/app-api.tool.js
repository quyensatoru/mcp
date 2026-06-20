import { z } from 'zod';
import { okContent, errorContent } from '../helpers/format.helper.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { appApiService } from '../services/app-api.service.js';

const ALLOWED_PREFIXES = [
    '/api/shops',
    '/api/health',
    '/api/settings',
    '/api/plans',
    '/api/modules',
    '/api/integrations',
    '/api/status',
];
const APP_TTL = 60;

function wrap(name, fn) {
    return async (args) => {
        try {
            return await fn(args);
        } catch (err) {
            return errorContent(
                `${name}: ${err.message}`,
                'Kiểm tra APP_API_BASE_URL, APP_API_TOKEN và path whitelist.',
            );
        }
    };
}

export function registerAppApiTools(server) {
    server.registerTool(
        'app_api_call',
        {
            title: 'App API Call',
            description:
                'Gọi Mida backend API nội bộ (GET only, whitelist path). Dùng để đọc settings, modules, integrations.',
            inputSchema: z.object({
                path: z.string().describe(`API path (whitelist: ${ALLOWED_PREFIXES.join(', ')})`),
                params: z.record(z.string()).default({}).describe('Query parameters'),
            }),
        },
        wrap('app_api_call', async ({ path, params }) => {
            const key = cacheKey('app_api_call', { path, params });
            const result = await withCache(key, APP_TTL, () =>
                appApiService.call(path, 'GET', Object.keys(params).length ? params : undefined),
            );
            return okContent(result, { label: `App API: ${path}` });
        }),
    );

    server.registerTool(
        'app_api_shop_status',
        {
            title: 'App API Shop Status',
            description:
                'Lấy tổng hợp trạng thái shop từ Mida backend: cài đặt, gói, ingest enabled. Đối chiếu với mongo_resolve_shop.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('app_api_shop_status', async ({ domain }) => {
            const key = cacheKey('app_api_shop_status', { domain });
            const result = await withCache(key, APP_TTL, () => appApiService.shopStatus(domain));
            return okContent(result, { label: `App status: ${domain}` });
        }),
    );
}
