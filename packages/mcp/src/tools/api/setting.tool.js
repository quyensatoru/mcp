import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { RecordingService } from '../../services/recorder/recording.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent } from '../../helpers/format.helper.js';
import { wrap } from '../../helpers/tool.helper.js';

const TTL = 60;

function formatSetting(setting, domain) {
    if (!setting) return `No setting found in API for ${domain}.`;
    const lines = [
        `Setting (api) — ${domain}`,
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

export function registerSettingApiTools(server) {
    server.registerTool(
        'recording_setting_api',
        {
            title: 'Recording Setting (API)',
            description:
                'Get the full recording setting from the API database: excluded IPs/countries, replay config, consent/cookie-bar flags, weekly email report, analytic sync. This is the source of truth.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('recording_setting_api', async ({ domain }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) return errorContent(`Shop not found: ${domain}`);
            const setting = await withCache(
                cacheKey('recording_setting_api', { proxy, shopId }),
                TTL,
                () => RecordingService.settingApi(proxy, shopId),
            );
            return textContent(formatSetting(setting, domain));
        }),
    );
}
