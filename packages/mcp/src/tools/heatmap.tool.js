import { z } from 'zod';
import { resolveProxy } from '../services/proxy.service.js';
import { HeatmapService } from '../services/heatmap.service.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { textContent, abbreviate } from '../helpers/format.helper.js';
import { toObjectId } from '../helpers/objectid.helper.js';
import { wrap } from '../helpers/tool.helper.js';

const TTL = 180;
const deviceArg = z.enum(['Desktop', 'Mobile', 'Tablet']).default('Desktop');

// pageId hoặc pageViewId → filter target; bắt buộc 1 trong 2.
function targetFilter({ pageId, pageViewId, device }) {
    if (!pageId && !pageViewId) throw new Error('Cần pageId hoặc pageViewId.');
    const filter = { device };
    if (pageId) filter.page = toObjectId(pageId);
    if (pageViewId) filter.pageView = toObjectId(pageViewId);
    return filter;
}

function formatClicks(clicks, device) {
    if (!clicks.length) return `Không có click data (device=${device}).`;
    const rows = clicks.map(
        (c, i) =>
            `${i + 1}. x:${c.x ?? '?'} y:${c.y ?? '?'} · ${c.counts ?? 0} clicks${c.type ? ` · ${c.type}` : ''} · ${abbreviate(c.selector, 60)}`,
    );
    return [`Top ${clicks.length} click hotspots (device=${device}):`, '', ...rows].join('\n');
}

function formatSelectors(selectors, device) {
    if (!selectors.length) return `Không có dữ liệu selector (device=${device}).`;
    const rows = selectors.map(
        (s, i) => `${i + 1}. ${s.clicks} clicks · ${s.points} points · ${abbreviate(s._id, 70)}`,
    );
    return [`Top ${selectors.length} elements by interaction (device=${device}):`, '', ...rows].join('\n');
}

function formatScroll(scrolls, device) {
    if (!scrolls.length) return `Không có scroll data (device=${device}).`;
    const rows = scrolls.map((s) => `  ${s.percent ?? s.depth ?? '?'}%: ${s.counts ?? 0} reached`);
    return [`Scroll depth distribution (device=${device}):`, ...rows].join('\n');
}

export function registerHeatmapTools(server) {
    server.registerTool(
        'heatmap_click',
        {
            title: 'Heatmap Click',
            description:
                'Top click hotspots theo toạ độ/selector của 1 page hoặc pageView. type lọc revenue/rage/dead/error click.',
            inputSchema: z.object({
                domain: z.string(),
                pageId: z.string().optional(),
                pageViewId: z.string().optional(),
                device: deviceArg,
                type: z.enum(['revenue-click', 'rage-click', 'dead-click', 'error-click']).optional(),
                limit: z.number().int().min(1).max(200).default(30),
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
            description: 'Phân bố scroll depth của 1 page/pageView theo device.',
            inputSchema: z.object({
                domain: z.string(),
                pageId: z.string().optional(),
                pageViewId: z.string().optional(),
                device: deviceArg,
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
            description: 'Top element/selector được tương tác nhiều nhất trên 1 page (gộp theo selector).',
            inputSchema: z.object({
                domain: z.string(),
                pageId: z.string(),
                device: deviceArg,
                limit: z.number().int().min(1).max(50).default(15),
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
