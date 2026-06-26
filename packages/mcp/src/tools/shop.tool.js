import { z } from 'zod';
import { resolveProxy } from '../services/proxy.service.js';
import { ShopService } from '../services/shop.service.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { textContent, errorContent, pct } from '../helpers/format.helper.js';
import { wrap } from '../helpers/tool.helper.js';

const TTL = 120;

function formatShopOverview(shop, proxy) {
    const sub = shop.subscription_info ?? {};
    const started = shop.started ?? {};
    const lines = [
        `Domain: ${shop.domain}`,
        `Shard: ${proxy}`,
        `Status: ${shop.status ? 'active' : 'inactive'}`,
        `Plan: ${shop.plan_code ?? '—'} (${sub.title ?? '—'})`,
        `Sessions: ${shop.session_count ?? 0} / ${sub.session_limit ?? '—'} (${pct(shop.session_count ?? 0, sub.session_limit)})`,
        `AI session limit: ${sub.ai_session_limit ?? '—'} · storage: ${sub.storage_days ?? '—'} days`,
        `Embed block: ${shop.embed_block ? 'ON' : 'OFF'} · pixel_id: ${shop.pixel_id ?? '—'}`,
        `Daily quota: ${shop.daily_quota_enabled ? `${shop.daily_used_quota_limit ?? 0} / ${shop.quota_limit_per_day ?? '—'}` : 'disabled'}`,
        `Onboarding: visitor=${started.view_visitor ? '✓' : '✗'} heatmap=${started.view_heatmap ? '✓' : '✗'} completed=${started.completed ? '✓' : '✗'}`,
        `Country: ${shop.country ?? '—'} · Shopify plan: ${shop.shopify_plan ?? '—'}`,
    ];
    if (shop.uninstall_app_date)
        lines.push(`⚠️ Uninstalled: ${new Date(shop.uninstall_app_date).toISOString()}`);
    return lines.join('\n');
}

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
            return textContent(formatShopOverview(data.shop, data.proxy));
        }),
    );
}
