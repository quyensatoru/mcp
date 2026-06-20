import { z } from 'zod';

// Parse ISO string hoặc relative time như "now-1h", "now-24h"
export function parseTime(value) {
  if (!value || value === 'now') return new Date();
  const match = value.match(/^now-(\d+)([smhd])$/);
  if (match) {
    const [, n, unit] = match;
    const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
    return new Date(Date.now() - Number(n) * ms);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new Error(`Invalid time value: ${value}`);
  return d;
}

// Mặc định: start=now-1h, end=now
export function resolveTimeRange(start, end, maxHours = 24) {
  const endDate = end ? parseTime(end) : new Date();
  const startDate = start ? parseTime(start) : new Date(endDate.getTime() - 3600000);
  const diffH = (endDate - startDate) / 3600000;
  if (diffH > maxHours) {
    throw new Error(`Time window quá lớn: ${diffH.toFixed(1)}h (tối đa ${maxHours}h)`);
  }
  return { start: startDate, end: endDate };
}

// Unix nanoseconds cho Loki
export function toNano(date) {
  return String(date.getTime()) + '000000';
}

export const timeRangeSchema = z.object({
  start: z.string().optional().describe('ISO 8601 hoặc "now-1h", "now-24h"'),
  end: z.string().optional().describe('ISO 8601 hoặc "now"'),
});

// Tên collection được phép đọc theo từng db
export const COLLECTION_WHITELIST = {
  api: [
    'shops',
    'visitors',
    'sessions',
    'pageviews',
    'pages',
    'events',
    'behaviors',
    'analytics',
    'plans',
    'settings',
    'integrations',
    'modules',
  ],
  heatmap: [
    'snapshots',
    'clicks',
    'moves',
    'scrolls',
    'sessions',
    'pageviews',
    'pages',
    'metrics',
    'shops',
  ],
  recorder: [
    'sessions',
    'shops',
    'plans',
    'modules',
    'settings',
    'visitorblocklists',
    'sessionmissings',
    'analytic_missing',
  ],
};

export function assertCollection(db, collection) {
  const allowed = COLLECTION_WHITELIST[db];
  if (!allowed) throw new Error(`Unknown db: ${db}`);
  if (!allowed.includes(collection)) {
    throw new Error(
      `Collection "${collection}" không có trong whitelist của db "${db}". Allowed: ${allowed.join(', ')}`,
    );
  }
}

// Stage pipeline bị chặn
const BLOCKED_STAGES = new Set(['$out', '$merge', '$function', '$where', '$accumulator']);

export function assertSafePipeline(pipeline) {
  if (!Array.isArray(pipeline)) throw new Error('Pipeline phải là array');
  for (const stage of pipeline) {
    for (const key of Object.keys(stage)) {
      if (BLOCKED_STAGES.has(key)) throw new Error(`Stage ${key} không được phép (write/unsafe)`);
    }
  }
}
