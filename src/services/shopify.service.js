import { fetch } from 'undici';
import { getShardConns } from './shard-resolver.service.js';
import { getShopModel } from '../models/api/shop.model.js';
import { env } from '../config/env.config.js';
import { logger } from '../helpers/logger.js';

async function getToken(domain) {
    const { api } = await getShardConns(domain);
    const Shop = getShopModel(api);
    const shop = await Shop.findOne({ domain }, { access_token: 1 }).lean().exec();
    if (!shop?.access_token) throw new Error(`Không tìm thấy access_token cho shop ${domain}`);
    return shop.access_token;
}

function shopifyBaseUrl(domain) {
    return `https://${domain}/admin/api/${env.SHOPIFY_API_VERSION}`;
}

export const shopifyService = {
    async graphql(domain, query, variables = {}) {
        const token = await getToken(domain);
        const url = `${shopifyBaseUrl(domain)}/graphql.json`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': token,
            },
            body: JSON.stringify({ query, variables }),
        });
        if (!resp.ok) throw new Error(`Shopify GraphQL ${resp.status}: ${await resp.text()}`);
        const json = await resp.json();
        if (json.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
        return json.data;
    },

    async rest(domain, path, method = 'GET', body) {
        const token = await getToken(domain);
        const url = `${shopifyBaseUrl(domain)}${path}`;
        const resp = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': token,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!resp.ok)
            throw new Error(
                `Shopify REST ${method} ${path} → ${resp.status}: ${await resp.text()}`,
            );
        return resp.json();
    },

    async checkEmbed(domain) {
        // Kiểm tra app embed + script tag Mida trong theme hiện tại
        const themeData = await this.graphql(
            domain,
            `
      query {
        themes(first: 5, roles: [MAIN]) {
          nodes { id name role }
        }
        scriptTags(first: 10) {
          nodes { id src displayScope }
        }
      }
    `,
        );
        const mainTheme = themeData?.themes?.nodes?.find((t) => t.role === 'MAIN');
        const scriptTags = themeData?.scriptTags?.nodes ?? [];
        const midaScript = scriptTags.find(
            (s) => s.src?.includes('mida') || s.src?.includes('getmida'),
        );
        return {
            mainTheme,
            scriptTags,
            midaScriptFound: !!midaScript,
            midaScript: midaScript ?? null,
            diagnosis: midaScript
                ? '✅ Mida script tag tồn tại'
                : '⚠️ Không tìm thấy Mida script tag — có thể app embed bị tắt hoặc theme không nhúng snippet',
        };
    },
};
