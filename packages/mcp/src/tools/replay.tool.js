import { z } from 'zod';
import { resolveProxy } from '../services/proxy.service.js';
import { ReplayService } from '../services/replay.service.js';
import { rrwebService } from '../services/rrweb.service.js';
import { screenshotService } from '../services/screenshot.service.js';
import { textContent, errorContent } from '../helpers/format.helper.js';
import { imageContent, diffImages } from '../helpers/image.helper.js';
import { wrap } from '../helpers/tool.helper.js';

const RRWEB_TYPE = {
    0: 'DomContentLoaded',
    1: 'Load',
    2: 'FullSnapshot',
    3: 'IncrementalSnapshot',
    4: 'Meta',
    5: 'Custom',
    6: 'Plugin',
};

function toRrwebEvents(docs) {
    return docs.map((e) => ({ type: e.type, timestamp: e.timestamp, data: e.data }));
}

function formatEventsSummary(events, pageViewId) {
    if (!events.length) return `No rrweb events for pageView ${pageViewId}.`;
    const byType = {};
    for (const e of events) {
        const name = RRWEB_TYPE[e.type] ?? `type${e.type}`;
        byType[name] = (byType[name] ?? 0) + 1;
    }
    const first = events[0].timestamp;
    const last = events[events.length - 1].timestamp;
    return [
        `rrweb events for pageView ${pageViewId}: ${events.length} events`,
        `  duration: ${last - first}ms`,
        `  has full snapshot: ${byType.FullSnapshot ? 'yes' : 'no — replay may break'}`,
        `  by type: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    ].join('\n');
}

function formatRenderMeta(meta) {
    return [
        `pageView: ${meta.pageViewId}`,
        `events: ${meta.eventCount} · seek: ${meta.seekMs}ms / ${meta.totalDuration}ms`,
        meta.errors?.length ? `replay errors: ${meta.errors.join('; ')}` : 'replay errors: none',
    ].join('\n');
}

export function registerReplayTools(server) {
    server.registerTool(
        'replay_events',
        {
            title: 'Replay Events Summary',
            description:
                'Summarize rrweb events for a pageview (count, type breakdown, duration, whether a full snapshot exists). Use to check if a recording has usable data before rendering.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                pageViewId: z.string().describe('PageView ObjectId'),
                limit: z.number().int().min(1).max(5000).default(2000).describe('Max events to scan'),
            }),
        },
        wrap('replay_events', async ({ domain, pageViewId, limit }) => {
            const proxy = await resolveProxy(domain);
            const events = await ReplayService.events(proxy, pageViewId, limit);
            return textContent(formatEventsSummary(events, pageViewId));
        }),
    );

    server.registerTool(
        'replay_render',
        {
            title: 'Replay Render',
            description:
                'Render the rrweb replay at a time offset into a PNG screenshot. Use to visually see what the page looked like during the session.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                pageViewId: z.string().describe('PageView ObjectId'),
                atMs: z.number().optional().describe('Offset in ms from replay start (omit = end)'),
                eventLimit: z.number().int().min(100).max(5000).default(1000).describe('Max events to load'),
            }),
        },
        wrap('replay_render', async ({ domain, pageViewId, atMs, eventLimit }) => {
            const proxy = await resolveProxy(domain);
            const docs = await ReplayService.events(proxy, pageViewId, eventLimit);
            if (!docs.length) return errorContent(`No events for pageView ${pageViewId}.`);
            const { buffer, seekMs, totalDuration, errors } = await rrwebService.render(
                toRrwebEvents(docs),
                { atMs },
            );
            return {
                content: [
                    imageContent(buffer, `rrweb replay @ ${seekMs}ms`),
                    { type: 'text', text: formatRenderMeta({ pageViewId, eventCount: docs.length, seekMs, totalDuration, errors }) },
                ],
            };
        }),
    );

    server.registerTool(
        'screenshot_url',
        {
            title: 'Screenshot URL',
            description:
                'Capture a live URL screenshot via Playwright. Use to compare the live storefront/page against a replay.',
            inputSchema: z.object({
                url: z.string().url().describe('URL to capture'),
                width: z.number().int().default(1280).describe('Viewport width'),
                height: z.number().int().default(800).describe('Viewport height'),
                waitFor: z.enum(['load', 'networkidle']).default('networkidle').describe('Wait condition before capture'),
            }),
        },
        wrap('screenshot_url', async ({ url, width, height, waitFor }) => {
            const { buffer, title, consoleErrors } = await screenshotService.capture(url, {
                viewport: { width, height },
                waitFor,
            });
            return {
                content: [
                    imageContent(buffer, `Screenshot: ${url}`),
                    { type: 'text', text: `url: ${url}\ntitle: ${title}\nconsole errors: ${consoleErrors.length ? consoleErrors.join('; ') : 'none'}` },
                ],
            };
        }),
    );

    server.registerTool(
        'replay_diagnose',
        {
            title: 'Replay Diagnose',
            description:
                'Render the replay vs a live URL and pixel-diff them. Returns replay, live, and diff images plus a verdict. Use to diagnose visual/CSS/JS breakage by comparing recorded vs current rendering.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                pageViewId: z.string().describe('PageView ObjectId'),
                compareUrl: z.string().url().describe('Live URL to compare against'),
                atMs: z.number().optional().describe('Offset in ms from replay start (omit = end)'),
                eventLimit: z.number().int().min(100).max(5000).default(1000).describe('Max events to load'),
            }),
        },
        wrap('replay_diagnose', async ({ domain, pageViewId, compareUrl, atMs, eventLimit }) => {
            const proxy = await resolveProxy(domain);
            const docs = await ReplayService.events(proxy, pageViewId, eventLimit);
            if (!docs.length) return errorContent(`No events for pageView ${pageViewId}.`);

            const [replay, live] = await Promise.all([
                rrwebService.render(toRrwebEvents(docs), { atMs }),
                screenshotService.capture(compareUrl, { viewport: { width: 1280, height: 800 } }),
            ]);
            const { diffBuffer, diffPercent, diffPixels, totalPixels } = diffImages(replay.buffer, live.buffer);
            const verdict =
                diffPercent > 30 ? '🔴 large difference (>30%) — likely broken CSS/JS or layout'
                : diffPercent > 10 ? '🟡 notable difference (10-30%) — possibly dynamic content'
                : '🟢 close match (<10%) — renders normally';

            return {
                content: [
                    imageContent(replay.buffer, 'rrweb replay'),
                    imageContent(live.buffer, 'live website'),
                    imageContent(diffBuffer, `diff ${diffPercent}%`),
                    {
                        type: 'text',
                        text: [
                            `diff: ${diffPercent}% (${diffPixels}/${totalPixels} px)`,
                            verdict,
                            `replay errors: ${replay.errors?.length ? replay.errors.join('; ') : 'none'}`,
                            `live console errors: ${live.consoleErrors?.length ? live.consoleErrors.join('; ') : 'none'}`,
                        ].join('\n'),
                    },
                ],
            };
        }),
    );
}
