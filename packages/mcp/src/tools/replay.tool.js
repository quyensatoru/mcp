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
    if (!events.length) return `Không có rrweb events cho pageView ${pageViewId}.`;
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
        `  has full snapshot: ${byType.FullSnapshot ? 'yes' : 'no — replay có thể vỡ'}`,
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
                'Tóm tắt rrweb events của 1 pageView (số lượng, loại, duration, có full snapshot không) — chẩn đoán recording có dữ liệu hay không.',
            inputSchema: z.object({
                domain: z.string(),
                pageViewId: z.string(),
                limit: z.number().int().min(1).max(5000).default(2000),
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
            description: 'Render rrweb replay tại mốc thời gian → ảnh PNG. Dùng để xem thực tế UI lúc replay.',
            inputSchema: z.object({
                domain: z.string(),
                pageViewId: z.string(),
                atMs: z.number().optional().describe('Mốc ms từ đầu replay (bỏ trống = cuối)'),
                eventLimit: z.number().int().min(100).max(5000).default(1000),
            }),
        },
        wrap('replay_render', async ({ domain, pageViewId, atMs, eventLimit }) => {
            const proxy = await resolveProxy(domain);
            const docs = await ReplayService.events(proxy, pageViewId, eventLimit);
            if (!docs.length) return errorContent(`Không có events cho pageView ${pageViewId}.`);
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
            description: 'Chụp website thật (storefront/page) bằng Playwright. Dùng để so sánh với replay.',
            inputSchema: z.object({
                url: z.string().url(),
                width: z.number().int().default(1280),
                height: z.number().int().default(800),
                waitFor: z.enum(['load', 'networkidle']).default('networkidle'),
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
                'So replay (snapshot) ↔ live URL: render cả hai + pixelmatch diff. Trả 3 ảnh (replay, live, diff) + chẩn đoán.',
            inputSchema: z.object({
                domain: z.string(),
                pageViewId: z.string(),
                compareUrl: z.string().url(),
                atMs: z.number().optional(),
                eventLimit: z.number().int().min(100).max(5000).default(1000),
            }),
        },
        wrap('replay_diagnose', async ({ domain, pageViewId, compareUrl, atMs, eventLimit }) => {
            const proxy = await resolveProxy(domain);
            const docs = await ReplayService.events(proxy, pageViewId, eventLimit);
            if (!docs.length) return errorContent(`Không có events cho pageView ${pageViewId}.`);

            const [replay, live] = await Promise.all([
                rrwebService.render(toRrwebEvents(docs), { atMs }),
                screenshotService.capture(compareUrl, { viewport: { width: 1280, height: 800 } }),
            ]);
            const { diffBuffer, diffPercent, diffPixels, totalPixels } = diffImages(replay.buffer, live.buffer);
            const verdict =
                diffPercent > 30 ? '🔴 khác biệt lớn (>30%) — CSS/JS lỗi hoặc layout vỡ'
                : diffPercent > 10 ? '🟡 khác biệt đáng chú ý (10-30%) — có thể nội dung động'
                : '🟢 gần giống (<10%) — hiển thị bình thường';

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
