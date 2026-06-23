import { fetch } from 'undici';
import { lokiConfig, getLokiHeaders } from '../config/loki.config.js';
import { resolveTimeRange, toNano } from '../helpers/validate.helper.js';
import { logger } from '@mida/logger';

const MAX_LIMIT = 500;

async function lokiGet(url, params) {
    if (!lokiConfig.baseUrl) throw new Error('LOKI_URL không được cấu hình');
    const qs = new URLSearchParams(params).toString();
    const resp = await fetch(`${url}?${qs}`, { headers: getLokiHeaders() });
    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Loki ${resp.status}: ${body.slice(0, 200)}`);
    }
    return resp.json();
}

function parseResult(data) {
    const streams = data?.data?.result ?? [];
    const lines = [];
    for (const s of streams) {
        for (const [ts, line] of s.values ?? []) {
            lines.push({ ts: new Date(Number(ts) / 1e6).toISOString(), labels: s.stream, line });
        }
    }
    lines.sort((a, b) => (a.ts > b.ts ? 1 : -1));
    return lines;
}

function summarizeLines(lines) {
    const byLevel = {};
    const topErrors = {};
    for (const { line, labels } of lines) {
        const lvl =
            labels?.level ??
            (line.includes('error') ? 'error' : line.includes('warn') ? 'warn' : 'info');
        byLevel[lvl] = (byLevel[lvl] ?? 0) + 1;
        if (lvl === 'error') {
            const key = line.slice(0, 120);
            topErrors[key] = (topErrors[key] ?? 0) + 1;
        }
    }
    const topErrorList = Object.entries(topErrors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([msg, count]) => ({ count, msg }));
    return { total: lines.length, byLevel, topErrors: topErrorList };
}

export const lokiService = {
    async queryRange({ query, start, end, limit = 100, direction = 'backward' }) {
        const { start: s, end: e } = resolveTimeRange(start, end, 24);
        const lim = Math.min(limit, MAX_LIMIT);
        const data = await lokiGet(lokiConfig.queryRangeUrl(), {
            query,
            start: toNano(s),
            end: toNano(e),
            limit: lim,
            direction,
        });
        const lines = parseResult(data);
        return { lines, summary: summarizeLines(lines) };
    },

    async searchErrors({ app, service, shop, level = 'error', start, end, limit = 100 }) {
        let selector = app ? `{app="${app}"}` : service ? `{service="${service}"}` : `{job=~".+"}`;
        let filter = ` |= \`${level}\``;
        if (shop) filter += ` |= \`${shop}\``;
        const query = selector + filter;
        return this.queryRange({ query, start, end, limit });
    },

    async trace({ traceId, start, end, limit = 200 }) {
        const query = `{job=~".+"} |= \`${traceId}\``;
        return this.queryRange({ query, start, end, limit, direction: 'forward' });
    },

    async queueHealth({ channel, service, start, end, limit = 200 }) {
        const keywords = [
            'nack',
            'reject',
            'channel error',
            'connection drop',
            'no consumer',
            'backlog',
            'slow',
        ];
        let selector = channel
            ? `{channel="${channel}"}`
            : service
              ? `{service="${service}"}`
              : `{job=~".+"}`;
        const filter = ` |~ \`${keywords.join('|')}\``;
        return this.queryRange({ query: selector + filter, start, end, limit });
    },

    async labels({ name, start, end }) {
        const { start: s, end: e } = resolveTimeRange(start, end, 24);
        if (name) {
            const data = await lokiGet(lokiConfig.labelValuesUrl(name), {
                start: toNano(s),
                end: toNano(e),
            });
            return { label: name, values: data.data ?? [] };
        }
        const data = await lokiGet(lokiConfig.labelsUrl(), {
            start: toNano(s),
            end: toNano(e),
        });
        return { labels: data.data ?? [] };
    },
};
