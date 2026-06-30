import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { RecordingService } from '../../services/recorder/recording.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent } from '../../helpers/format.helper.js';
import { wrap } from '../../helpers/tool.helper.js';

const TTL = 60;

function formatSetting(setting, source, domain) {
    if (!setting) return `No setting found in ${source} for ${domain}.`;
    const lines = [
        `Setting (${source}) — ${domain}`,
        `  replay_speed: ${setting.replay_speed ?? '—'} · replay_autoplay: ${setting.replay_autoplay ?? '—'} · replay_mode: ${setting.replay_mode ?? '—'}`,
        `  delay_capture: ${setting.delay_capture ?? '—'} · mask_checkout: ${setting.mask_checkout ?? '—'}`,
        `  collect_email: ${setting.collect_email ?? '—'} · require_consent: ${setting.require_consent ?? '—'} · show_cookies_bar: ${setting.show_cookies_bar ?? '—'}`,
        `  excluded_ips: ${setting.excluded_ips?.length ? setting.excluded_ips.join(', ') : 'none'}`,
        `  excluded_countries: ${setting.excluded_countries?.length ? setting.excluded_countries.join(', ') : 'none'}`,
    ];
    if (setting.weekly_email_report) {
        const wer = setting.weekly_email_report;
        lines.push(
            `  weekly_email_report: ${wer.status ? 'ON' : 'OFF'} · day=${wer.day_of_week ?? '—'} hour=${wer.hour_of_day ?? '—'}`,
        );
    }
    if (setting.analytic_sync) {
        const as = setting.analytic_sync;
        lines.push(`  analytic_sync: ${as.status ? 'ON' : 'OFF'} · type=${as.sync_type ?? '—'}`);
    }
    lines.push(`  updatedAt: ${setting.updatedAt ? new Date(setting.updatedAt).toISOString() : '—'}`);
    return lines.join('\n');
}

function formatSettingCompare(apiSetting, recSetting, domain) {
    const settingFields = [
        'replay_speed', 'replay_autoplay', 'collect_email',
        'require_consent', 'show_cookies_bar', 'delay_capture', 'mask_checkout',
    ];
    const drifts = settingFields.filter(
        (f) => JSON.stringify(apiSetting?.[f]) !== JSON.stringify(recSetting?.[f]),
    );
    const lines = [
        `Setting compare — ${domain}`,
        `  api: ${apiSetting ? 'found' : 'NOT_FOUND'} · recorder: ${recSetting ? 'found' : 'NOT_FOUND'}`,
        drifts.length
            ? `  ⚠️ Drift on: ${drifts.map((f) => `${f}(api=${apiSetting?.[f]} rec=${recSetting?.[f]})`).join(', ')}`
            : '  ✓ Settings in sync',
    ];
    return lines.join('\n');
}

export function registerSettingRecorderTools(server) {
    server.registerTool(
        'recording_setting',
        {
            title: 'Recording Setting (Compare)',
            description:
                'Compare recording settings between API and Recorder: excluded_ips, excluded_countries, replay_speed, require_consent, etc. Highlights drift. Use when recorder behaviour does not match the shop\'s configured settings.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('recording_setting', async ({ domain }) => {
            const data = await withCache(
                cacheKey('recording_setting', { domain }),
                TTL,
                async () => {
                    const proxy = await resolveProxy(domain);
                    const shopId = await ShopService.idByDomain(proxy, domain);
                    if (!shopId) return { missing: true };
                    const [apiSetting, recSetting] = await Promise.all([
                        RecordingService.settingApi(proxy, shopId),
                        RecordingService.settingRecorder(proxy, shopId),
                    ]);
                    return { proxy, apiSetting, recSetting };
                },
            );
            if (data.missing) return errorContent(`Shop not found: ${domain}`);
            return textContent(
                [
                    formatSettingCompare(data.apiSetting, data.recSetting, domain),
                    '',
                    formatSetting(data.apiSetting, 'api', domain),
                    '',
                    formatSetting(data.recSetting, 'recorder', domain),
                ].join('\n'),
            );
        }),
    );

    server.registerTool(
        'recording_setting_recorder',
        {
            title: 'Recording Setting (Recorder)',
            description:
                'Get the recording setting from the Recorder replica database. Use to verify the recorder has the correct settings synced from the API.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('recording_setting_recorder', async ({ domain }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);
            const setting = await withCache(
                cacheKey('recording_setting_recorder', { proxy, shopId }),
                TTL,
                () => RecordingService.settingRecorder(proxy, shopId),
            );
            return textContent(formatSetting(setting, 'recorder', domain));
        }),
    );
}
