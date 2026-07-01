import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent, formatSetting } from '../../helpers/format.helper.js';
import { wrap } from '../../helpers/tool.helper.js';
import { SettingService } from '../../services/api/setting.service.js';

const TTL = 60;

export function registerSettingApiTools(server) {
    server.registerTool(
        'api_get_setting',
        {
            title: 'Recording Setting (API)',
            description:
                'Get the full recording setting from the API database: excluded IPs/countries, replay config, consent/cookie-bar flags, weekly email report, analytic sync. This is the source of truth.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('api_get_setting', async ({ domain }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);
            if (!shopId) {
                return errorContent(`Shop not found: ${domain}`);
            }

            const setting = await withCache(
                cacheKey('api_get_setting', { proxy, shopId }),
                TTL,
                () => SettingService.findOne(proxy, shopId),
            );
            return textContent(formatSetting(setting, domain, 'API'));
        }),
    );
}
