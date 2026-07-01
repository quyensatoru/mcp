import { z } from 'zod';
import { resolveProxy } from '../../services/proxy.service.js';
import { ShopService } from '../../services/api/shop.service.js';
import { cacheKey, withCache } from '../../helpers/redis.helper.js';
import { textContent, errorContent, formatModule } from '../../helpers/format.helper.js';
import { wrap } from '../../helpers/tool.helper.js';
import { RecorderModuleService } from '../../services/recorder/module.service.js';

const TTL = 60;

export function registerModuleRecorderTools(server) {
    server.registerTool(
        'recorder_get_module_config',
        {
            title: 'Recording Module (Recorder)',
            description:
                'Get module records (sr=Session Recording, sv=Survey) from the Recorder database. Shows key, status, and metafield_id. Use to check the source-of-truth module state.',
            inputSchema: z.object({
                domain: z.string().describe('Shopify domain'),
            }),
        },
        wrap('recorder_get_module_config', async ({ domain }) => {
            const proxy = await resolveProxy(domain);
            const shopId = await ShopService.idByDomain(proxy, domain);

            if (!shopId) {
                return errorContent(`Shop not found: ${domain}`);
            }
            
            const modules = await withCache(
                cacheKey('recorder_get_module_config', { proxy, shopId }),
                TTL,
                () => RecorderModuleService.findOne(proxy, shopId),
            );
            return textContent(formatModule(modules, domain, 'Recorder'));
        }),
    );
}
