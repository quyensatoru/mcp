import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import {
    textContent,
    errorContent,
    formatModule,
    formatConfiguration,
} from '../../helpers/format.helper.js';
import { wrap } from '../../helpers/tool.helper.js';
import { ModuleService } from '../../services/api/module.service.js';
import { ConfigurationService } from '../../services/api/configuration.service.js';

const TTL = 60;

export function registerModuleApiTools(server) {
    server.registerTool(
        'api_get_module_config',
        {
            title: 'Get modules config (API)',
            description:
                'Get module records (sr=Session Recording, sv=Survey) from the API database. Shows key, status, and metafield_id. Use to check the source-of-truth module state.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('api_get_module_config', async ({ domain }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);

            if (!shopId) {
                return errorContent(`Shop not found: ${domain}`);
            }

            const modules = await withCache(
                cacheKey('api_get_module_config', { proxy, shopId }),
                TTL,
                () => ModuleService.findOne(proxy, shopId),
            );
            return textContent(formatModule(modules, domain, 'API'));
        }),
    );

    server.registerTool(
        'api_get_configurations',
        {
            title: 'Configuration (API)',
            description:
                "Get the shop's Configuration from the API: heatmap page limit, survey limit, share_recording type, funnel_analytics definitions, and restrict_filter flags. Use to understand what plan-level features and limits apply to this shop.",
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('api_get_configurations', async ({ domain }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);

            if (!shopId) {
                return errorContent(`Shop not found: ${domain}`);
            }

            const config = await withCache(
                cacheKey('api_get_configurations', { proxy, shopId }),
                TTL,
                () => ConfigurationService.findOne(proxy, shopId),
            );
            return textContent(formatConfiguration(config, domain, 'API'));
        }),
    );
}
