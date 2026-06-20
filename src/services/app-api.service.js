import { fetch } from 'undici';
import { env } from '../config/env.config.js';

function baseUrl() {
    if (!env.APP_API_BASE_URL) throw new Error('APP_API_BASE_URL chưa được cấu hình');
    return env.APP_API_BASE_URL;
}

// Whitelist path prefix được phép gọi (đọc-only)
const ALLOWED_PREFIXES = [
    '/api/shops',
    '/api/health',
    '/api/settings',
    '/api/plans',
    '/api/modules',
    '/api/integrations',
    '/api/status',
];

function assertPath(path) {
    if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
        throw new Error(
            `Path "${path}" không có trong whitelist. Allowed: ${ALLOWED_PREFIXES.join(', ')}`,
        );
    }
}

export const appApiService = {
    async call(path, method = 'GET', params) {
        assertPath(path);
        let url = `${baseUrl()}${path}`;
        if (method === 'GET' && params) {
            url += '?' + new URLSearchParams(params).toString();
        }
        const resp = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(env.APP_API_TOKEN ? { Authorization: `Bearer ${env.APP_API_TOKEN}` } : {}),
            },
            body: method !== 'GET' && params ? JSON.stringify(params) : undefined,
        });
        if (!resp.ok)
            throw new Error(`App API ${method} ${path} → ${resp.status}: ${await resp.text()}`);
        return resp.json();
    },

    async shopStatus(domain) {
        const data = await this.call(`/api/shops/${encodeURIComponent(domain)}/status`);
        return data;
    },
};
