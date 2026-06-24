import { z } from 'zod';
import { resolveProxy } from '../services/proxy.service.js';
import { HeatmapService } from '../services/heatmap.service.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { textContent, abbreviate } from '../helpers/format.helper.js';
import { toObjectId } from '../helpers/objectid.helper.js';
import { wrap } from '../helpers/tool.helper.js';

const TTL = 180;
const deviceArg = z.enum(['Desktop', 'Mobile', 'Tablet']).default('Desktop');

// pageId or pageViewId → target filter; exactly one is required.
function targetFilter({ pageId, pageViewId, device }) {
    if (!pageId && !pageViewId) throw new Error('Provide pageId or pageViewId.');
    const filter = { device };
    if (pageId) filter.page = toObjectId(pageId);
    if (pageViewId) filter.pageView = toObjectId(pageViewId);
    return filter;
}

function formatClicks(clicks, device) {
    if (!clicks.length) return `No click data (device=${device}).`;
    const rows = clicks.map(
        (c, i) =>
            `${i + 1}. x:${c.x ?? '?'} y:${c.y ?? '?'} · ${c.counts ?? 0} clicks${c.type ? ` · ${c.type}` : ''} · ${abbreviate(c.selector, 60)}`,
    );
    return [`Top ${clicks.length} click hotspots (device=${device}):`, '', ...rows].join('\n');
}

function formatSelectors(selectors, device) {
    if (!selectors.length) return `No selector data (device=${device}).`;
    const rows = selectors.map(
        (s, i) => `${i + 1}. ${s.clicks} clicks · ${s.points} points · ${abbreviate(s._id, 70)}`,
    );
    return [`Top ${selectors.length} elements by interaction (device=${device}):`, '', ...rows].join('\n');
}

function formatScroll(scrolls, device) {
    if (!scrolls.length) return `No scroll data (device=${device}).`;
    const rows = scrolls.map((s) => `  ${s.percent ?? s.depth ?? '?'}%: ${s.counts ?? 0} reached`);
    return [`Scroll depth distribution (device=${device}):`, ...rows].join('\n');
}

export function registerHeatmapTools(server) {
    server.registerTool(
        'heatmap_click',
        {
            title: 'Heatmap Click',
            description:
                'Top click hotspots (coordinates/selector + counts) for a page or pageview. Filter by device and click type. Use for "where do users click" and rage/dead/error-click problems.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                pageId: z.string().optional().describe('Page ObjectId (from page_list)'),
                pageViewId: z.string().optional().describe('PageView ObjectId'),
                device: deviceArg.describe('Device type (default Desktop)'),
                type: z
                    .enum(['revenue-click', 'rage-click', 'dead-click', 'error-click'])
                    .optional()
                    .describe('Filter by click type'),
                limit: z.number().int().min(1).max(200).default(30).describe('Max hotspots to return'),
            }),
        },
        wrap('heatmap_click', async ({ domain, pageId, pageViewId, device, type, limit }) => {
            const proxy = await resolveProxy(domain);
            const filter = targetFilter({ pageId, pageViewId, device });
            if (type) filter.type = type;
            const clicks = await withCache(cacheKey('heatmap_click', { proxy, filter, limit }), TTL, () =>
                HeatmapService.clicks(proxy, filter, limit),
            );
            return textContent(formatClicks(clicks, device));
        }),
    );

    server.registerTool(
        'heatmap_scroll',
        {
            title: 'Heatmap Scroll',
            description:
                'Scroll-depth distribution for a page/pageview by device. Use for "how far do users scroll" or content-below-the-fold questions.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                pageId: z.string().optional().describe('Page ObjectId (from page_list)'),
                pageViewId: z.string().optional().describe('PageView ObjectId'),
                device: deviceArg.describe('Device type (default Desktop)'),
            }),
        },
        wrap('heatmap_scroll', async ({ domain, pageId, pageViewId, device }) => {
            const proxy = await resolveProxy(domain);
            const filter = targetFilter({ pageId, pageViewId, device });
            const scrolls = await withCache(cacheKey('heatmap_scroll', { proxy, filter }), TTL, () =>
                HeatmapService.scrolls(proxy, filter),
            );
            return textContent(formatScroll(scrolls, device));
        }),
    );

    server.registerTool(
        'heatmap_page_insight',
        {
            title: 'Heatmap Page Insight',
            description:
                'Top interacted elements on a page, aggregated by CSS selector. Use for a quick "which elements get the most engagement" summary of a page.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                pageId: z.string().describe('Page ObjectId (from page_list)'),
                device: deviceArg.describe('Device type (default Desktop)'),
                limit: z.number().int().min(1).max(50).default(15).describe('Max elements to return'),
            }),
        },
        wrap('heatmap_page_insight', async ({ domain, pageId, device, limit }) => {
            const proxy = await resolveProxy(domain);
            const filter = { page: toObjectId(pageId), device };
            const selectors = await withCache(cacheKey('heatmap_page_insight', { proxy, filter, limit }), TTL, () =>
                HeatmapService.clickSelectors(proxy, filter, limit),
            );
            return textContent(formatSelectors(selectors, device));
        }),
    );
}
