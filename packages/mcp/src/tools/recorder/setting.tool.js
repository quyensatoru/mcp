import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent, formatSetting } from '../../helpers/format.helper.js';
import { wrap } from '../../helpers/tool.helper.js';
import { RecorderSettingService } from '../../services/recorder/setting.service.js';

const TTL = 60;

export function registerSettingRecorderTools(server) {
    server.registerTool(
        'recorder_get_setting',
        {
            title: 'Recording Setting (Compare)',
            description:
                "Compare recording settings between API and Recorder: excluded_ips, excluded_countries, replay_speed, require_consent, etc. Highlights drift. Use when recorder behaviour does not match the shop's configured settings.",
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('recorder_get_setting', async ({ domain }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) {
                return errorContent(`Shop not found: ${domain}`);
            }

            const setting = await withCache(
                cacheKey('recorder_get_setting', { domain }),
                TTL,
                async () => RecorderSettingService.findOne(proxy, shopId),
            );

            if (!setting) return errorContent(`Setting not found: ${domain}`);

            return textContent(formatSetting(setting, domain, 'Recorder'));
        }),
    );
}
