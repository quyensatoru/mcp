import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { RecordingService } from '../../services/recorder/recording.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent } from '../../helpers/format.helper.js';
import { wrap } from '../../helpers/tool.helper.js';

const TTL = 60;
const MODULE_KEY_LABEL = { sr: 'Session Recording', sv: 'Survey' };

function formatModuleApi(modules, domain) {
    if (!modules.length) return `No module records found in API for ${domain}.`;
    const lines = [`API modules — ${domain}`, ''];
    for (const m of modules) {
        const label = MODULE_KEY_LABEL[m.key] ?? m.key;
        lines.push(
            `  ${label} (${m.key}): ${m.status ? 'ON' : 'OFF'} · metafield: ${m.metafield_id ?? '—'} · updated: ${m.updatedAt ? new Date(m.updatedAt).toISOString() : '—'}`,
        );
    }
    return lines.join('\n');
}

function formatConfiguration(config, domain) {
    if (!config) return `No configuration found in API for ${domain}.`;
    const hm = config.heatmaps ?? {};
    const sv = config.survey ?? {};
    const sr = config.share_recording ?? {};
    const lines = [
        `Configuration — ${domain}`,
        `  Heatmaps: limit=${hm.limit ?? '—'} · extend=${hm.extend ?? '—'} · pages=${hm.pages?.length ?? 0} · lock_metric=${hm.lock_metric_status ?? '—'}`,
        `  Survey: limit=${sv.limit ?? '—'} · extend=${sv.extend ?? '—'}`,
        `  Share recording: type=${sr.type ?? '—'}`,
        `  Funnel analytics: ${config.funnel_analytics?.length ?? 0} funnels defined`,
    ];
    if (config.funnel_analytics?.length) {
        config.funnel_analytics
            .slice(0, 5)
            .forEach((fn, i) =>
                lines.push(`    ${i + 1}. ${fn.name ?? '—'} (${fn.steps?.length ?? 0} steps)`),
            );
    }
    lines.push(`  updatedAt: ${config.updatedAt ? new Date(config.updatedAt).toISOString() : '—'}`);
    return lines.join('\n');
}

export function registerModuleApiTools(server) {
    server.registerTool(
        'recording_module_api',
        {
            title: 'Recording Module (API)',
            description:
                'Get module records (sr=Session Recording, sv=Survey) from the API database. Shows key, status, and metafield_id. Use to check the source-of-truth module state.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('recording_module_api', async ({ domain }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);
            const modules = await withCache(
                cacheKey('recording_module_api', { proxy, shopId }),
                TTL,
                () => RecordingService.moduleApi(proxy, shopId),
            );
            return textContent(formatModuleApi(modules, domain));
        }),
    );

    server.registerTool(
        'recording_config',
        {
            title: 'Recording Configuration',
            description:
                'Get the shop\'s Configuration from the API: heatmap page limit, survey limit, share_recording type, funnel_analytics definitions, and restrict_filter flags. Use to understand what plan-level features and limits apply to this shop.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('recording_config', async ({ domain }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);
            const config = await withCache(
                cacheKey('recording_config', { proxy, shopId }),
                TTL,
                () => RecordingService.configurationApi(proxy, shopId),
            );
            return textContent(formatConfiguration(config, domain));
        }),
    );
}
