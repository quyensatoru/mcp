import { z } from 'zod';
import { resolveProxy } from '../services/proxy.service.js';
import { ShopService } from '../services/shop.service.js';
import { AnalyticService } from '../services/analytics.service.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { textContent, errorContent, pct } from '../helpers/format.helper.js';
import { wrap } from '../helpers/tool.helper.js';

const TTL = 300;
const dateArg = z.string().describe('YYYY-MM-DD');

function formatDailyRow(a) {
    const v = a.data?.visitor ?? {};
    const s = a.data?.session ?? {};
    return (
        `${a.date}: visitors ${v.count ?? 0} (new ${v.new_visitor ?? 0}/ret ${v.returning_visitor ?? 0}) · ` +
        `sessions ${s.count ?? 0} · ATC ${s.count_atc ?? 0} · checkout ${s.count_checkout ?? 0} · ` +
        `purchased ${s.count_purchased ?? 0} · CVR ${s.conversion_rate ?? 0} · bounce ${s.bounce_rate ?? 0}`
    );
}

function formatAnalyticsDaily(analytics, domain, from, to) {
    if (!analytics.length) return `No analytics for ${domain} (${from} → ${to}).`;
    return [`Analytics ${domain} (${from} → ${to}) — ${analytics.length} days:`, '', ...analytics.map(formatDailyRow)].join('\n');
}

function formatConversionFunnel(analytics, domain, from, to) {
    const t = analytics.reduce(
        (acc, a) => {
            const s = a.data?.session ?? {};
            acc.sessions += s.count ?? 0;
            acc.view += s.count_view_product ?? 0;
            acc.atc += s.count_atc ?? 0;
            acc.checkout += s.count_checkout ?? 0;
            acc.purchased += s.count_purchased ?? 0;
            return acc;
        },
        { sessions: 0, view: 0, atc: 0, checkout: 0, purchased: 0 },
    );
    return [
        `Conversion funnel ${domain} (${from} → ${to}):`,
        '',
        `  Sessions:      ${t.sessions}`,
        `  View product:  ${t.view} (${pct(t.view, t.sessions)} of sessions)`,
        `  Add to cart:   ${t.atc} (${pct(t.atc, t.view)} of view)`,
        `  Checkout:      ${t.checkout} (${pct(t.checkout, t.atc)} of ATC)`,
        `  Purchased:     ${t.purchased} (${pct(t.purchased, t.checkout)} of checkout)`,
        '',
        `  Overall CVR (purchased/sessions): ${pct(t.purchased, t.sessions)}`,
    ].join('\n');
}

async function loadAnalytics(domain, dateFrom, dateTo) {
    return withCache(cacheKey('analytics', { domain, dateFrom, dateTo }), TTL, async () => {
        const proxy = await resolveProxy(domain);
        const shopId = await ShopService.idByDomain(proxy, domain);
        if (!shopId) return { shopId: null, analytics: [] };
        const analytics = await AnalyticService.byDateRange(proxy, shopId, dateFrom, dateTo);
        return { shopId, analytics };
    });
}

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
            const { shopId, analytics } = await loadAnalytics(domain, dateFrom, dateTo);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);
            return textContent(formatAnalyticsDaily(analytics, domain, dateFrom, dateTo));
        }),
    );

    server.registerTool(
        'conversion_funnel',
        {
            title: 'Conversion Funnel',
            description:
                'Aggregated funnel over a date range: sessions → product view → add to cart → checkout → purchased, with drop-off % at each step. Use to find where users drop off or diagnose conversion problems.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                dateFrom: dateArg,
                dateTo: dateArg,
            }),
        },
        wrap('conversion_funnel', async ({ domain, dateFrom, dateTo }) => {
            const { shopId, analytics } = await loadAnalytics(domain, dateFrom, dateTo);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);
            return textContent(formatConversionFunnel(analytics, domain, dateFrom, dateTo));
        }),
    );
}
