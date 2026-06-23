import { env } from './env.config.js';

export function getLokiHeaders() {
    const headers = { 'Content-Type': 'application/json' };

    if (env.LOKI_TOKEN) {
        headers['Authorization'] = `Bearer ${env.LOKI_TOKEN}`;
    } else if (env.LOKI_USER && env.LOKI_PASS) {
        const basic = Buffer.from(`${env.LOKI_USER}:${env.LOKI_PASS}`).toString('base64');
        headers['Authorization'] = `Basic ${basic}`;
    }

    if (env.LOKI_ORG_ID) {
        headers['X-Scope-OrgID'] = env.LOKI_ORG_ID;
    }

    return headers;
}

export const lokiConfig = {
    get baseUrl() {
        return env.LOKI_URL;
    },
    queryRangeUrl: () => `${env.LOKI_URL}/loki/api/v1/query_range`,
    labelsUrl: () => `${env.LOKI_URL}/loki/api/v1/labels`,
    labelValuesUrl: (name) => `${env.LOKI_URL}/loki/api/v1/label/${name}/values`,
};
