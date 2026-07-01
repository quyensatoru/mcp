import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { AnalyticService } from '../../services/api/analytics.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent, pct, formatAnalytics } from '../../helpers/format.helper.js';
import { wrap } from '../../helpers/tool.helper.js';

const TTL = 300;
const dateArg = z.string().describe('YYYY-MM-DD');

export function registerAnalyticsTools(server) {
    server.registerTool(
        'analytics_daily',
        {
            title: 'Analytics Daily',
            description:
                'Per-day metrics over a date range: visitors (new/returning), sessions, add-to-cart, checkout, purchased, conversion & bounce rate. Use for store-performance and traffic/sales-trend questions, or to verify aggregated daily numbers.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                dateFrom: dateArg,
                dateTo: dateArg,
            }),
        },
        wrap('analytics_daily', async ({ domain, dateFrom, dateTo }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) {
                return errorContent(`Shop not found: ${domain}`);
            }

            const analytics = await withCache(
                cacheKey('analytics', { domain, dateFrom, dateTo }),
                TTL,
                async () => AnalyticService.byDateRange(proxy, shopId, dateFrom, dateTo),
            );

            return textContent(formatAnalytics(analytics, domain, dateFrom, dateTo));
        }),
    );
}
