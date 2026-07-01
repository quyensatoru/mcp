import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent, pct, formatShop } from '../../helpers/format.helper.js';
import { wrap } from '../../helpers/tool.helper.js';

const TTL = 120;

export function registerShopTool(server) {
    server.registerTool(
        'shop_overview',
        {
            title: 'Shop Overview',
            description:
                'STEP 0 for any shop-scoped query. Resolves the data shard and returns shop status, plan, session-quota usage, embed/pixel install state, and onboarding flags. Call this first to confirm the shop exists, is active, and has quota before deeper analysis. Access token is never returned.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain, e.g. "store.myshopify.com"'),
            }),
        },
        wrap('shop_overview', async ({ domain }) => {
            const data = await withCache(cacheKey('shop_overview', { domain }), TTL, async () => {
                const proxy = await resolveProxy(domain);
                const shop = await ShopService.findByDomain(proxy, domain);
                return { proxy, shop };
            });
            if (!data.shop)
                return errorContent(
                    `Shop not found in api: ${domain}`,
                    'Check the domain spelling.',
                );
            return textContent(formatShop(data.shop, data.proxy, 'API'));
        }),
    );
}
