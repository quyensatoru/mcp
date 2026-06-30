import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { RecordingService } from '../../services/recorder/recording.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent } from '../../helpers/format.helper.js';
import { wrap } from '../../helpers/tool.helper.js';

const TTL = 60;
const MODULE_KEY_LABEL = { sr: 'Session Recording', sv: 'Survey' };

function formatModules(apiModules, recorderModules, domain) {
    const keys = ['sr', 'sv'];
    const lines = [`Module status — ${domain}`, ''];
    for (const key of keys) {
        const label = MODULE_KEY_LABEL[key] ?? key;
        const api = apiModules.find((m) => m.key === key);
        const rec = recorderModules.find((m) => m.key === key);
        const apiStatus = api ? (api.status ? 'ON' : 'OFF') : 'NOT_FOUND';
        const recStatus = rec ? (rec.status ? 'ON' : 'OFF') : 'NOT_FOUND';
        const drift = api && rec && api.status !== rec.status ? ' ⚠️ DRIFT' : '';
        lines.push(`  ${label} (${key}): api=${apiStatus} · recorder=${recStatus}${drift}`);
        if (api?.metafield_id) lines.push(`    metafield_id: ${api.metafield_id}`);
    }
    return lines.join('\n');
}

function formatModuleRecorder(modules, domain) {
    if (!modules.length) return `No module records found in Recorder for ${domain}.`;
    const lines = [`Recorder modules — ${domain}`, ''];
    for (const m of modules) {
        const label = MODULE_KEY_LABEL[m.key] ?? m.key;
        lines.push(
            `  ${label} (${m.key}): ${m.status ? 'ON' : 'OFF'} · updated: ${m.updatedAt ? new Date(m.updatedAt).toISOString() : '—'}`,
        );
    }
    return lines.join('\n');
}

export function registerModuleRecorderTools(server) {
    server.registerTool(
        'recording_module',
        {
            title: 'Recording Module (Compare)',
            description:
                'Compare module status (sr=Session Recording, sv=Survey) between API and recorder databases. Highlights drift. Use when a module is ON in API but the recorder is not capturing, or vice versa.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('recording_module', async ({ domain }) => {
            const data = await withCache(
                cacheKey('recording_module', { domain }),
                TTL,
                async () => {
                    const proxy = await resolveProxy(domain);
                    const shopId = await ShopService.idByDomain(proxy, domain);
                    if (!shopId) return { missing: true };
                    const [apiModules, recorderModules] = await Promise.all([
                        RecordingService.moduleApi(proxy, shopId),
                        RecordingService.moduleRecorder(proxy, shopId),
                    ]);
                    return { proxy, apiModules, recorderModules };
                },
            );
            if (data.missing) return errorContent(`Shop not found: ${domain}`);
            return textContent(formatModules(data.apiModules, data.recorderModules, domain));
        }),
    );

    server.registerTool(
        'recording_module_recorder',
        {
            title: 'Recording Module (Recorder)',
            description:
                'Get module records (sr=Session Recording, sv=Survey) from the Recorder replica database. Use to verify the recorder has the correct module state synced from the API.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('recording_module_recorder', async ({ domain }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);
            const modules = await withCache(
                cacheKey('recording_module_recorder', { proxy, shopId }),
                TTL,
                () => RecordingService.moduleRecorder(proxy, shopId),
            );
            return textContent(formatModuleRecorder(modules, domain));
        }),
    );
}
