import { z } from 'zod';
import { okContent, errorContent } from '../helpers/format.helper.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { shopifyService } from '../services/shopify.service.js';

const SHOPIFY_TTL = 120;

function wrap(name, fn) {
  return async (args) => {
    try { return await fn(args); }
    catch (err) { return errorContent(`${name}: ${err.message}`, 'Kiểm tra SHOPIFY_API_VERSION và Shopify Admin API token trong DB.'); }
  };
}

export function registerShopifyTools(server) {
  server.registerTool('shopify_graphql', {
    title: 'Shopify GraphQL',
    description: 'Chạy GraphQL query lên Shopify Admin API (token lấy từ DB). Dùng để kiểm tra theme, app embed, script tags, webhooks.',
    inputSchema: z.object({
      domain: z.string().describe('Shopify domain'),
      query: z.string().describe('GraphQL query string'),
      variables: z.record(z.unknown()).default({}).describe('GraphQL variables'),
    }),
  }, wrap('shopify_graphql', async ({ domain, query, variables }) => {
    const key = cacheKey('shopify_graphql', { domain, query, variables });
    const result = await withCache(key, SHOPIFY_TTL, () => shopifyService.graphql(domain, query, variables));
    return okContent(result, { label: `Shopify GraphQL: ${domain}` });
  }));

  server.registerTool('shopify_rest', {
    title: 'Shopify REST',
    description: 'Gọi Shopify Admin REST API (GET only). Dùng khi cần data không có trong GraphQL.',
    inputSchema: z.object({
      domain: z.string(),
      path: z.string().describe('API path, vd: "/themes.json", "/script_tags.json"'),
    }),
  }, wrap('shopify_rest', async ({ domain, path }) => {
    const key = cacheKey('shopify_rest', { domain, path });
    const result = await withCache(key, SHOPIFY_TTL, () => shopifyService.rest(domain, path, 'GET'));
    return okContent(result, { label: `Shopify REST GET ${path}` });
  }));

  server.registerTool('shopify_check_embed', {
    title: 'Shopify Check Embed',
    description: 'Kiểm tra app embed / script tag Mida có active trong Shopify theme không. Là một trong những check đầu tiên khi "session không ghi".',
    inputSchema: z.object({
      domain: z.string(),
    }),
  }, wrap('shopify_check_embed', async ({ domain }) => {
    const key = cacheKey('shopify_check_embed', { domain });
    const result = await withCache(key, SHOPIFY_TTL, () => shopifyService.checkEmbed(domain));
    return okContent(result, { label: `Shopify embed check: ${domain}` });
  }));
}
