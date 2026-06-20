import { z } from 'zod';
import { lokiService } from '../services/loki.service.js';
import { okContent, errorContent } from '../helpers/format.helper.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import { timeRangeSchema } from '../helpers/validate.helper.js';
import { env } from '../config/env.config.js';

const LOKI_TTL = 60; // 1 phút (near-realtime)

function wrap(fn) {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      return errorContent(`Loki error: ${err.message}`, 'Kiểm tra LOKI_URL, LOKI_TOKEN/USER/PASS và kết nối mạng.');
    }
  };
}

export function registerLokiTools(server) {
  server.registerTool(
    'loki_query',
    {
      title: 'Loki Query (LogQL)',
      description: 'Chạy truy vấn LogQL tuỳ chỉnh trên Loki. Dùng khi cần query nâng cao. Trả log lines + summary.',
      inputSchema: z.object({
        query: z.string().describe('LogQL query, ví dụ: {app="sama-api"} |= "error"'),
        ...timeRangeSchema.shape,
        limit: z.number().int().min(1).max(500).default(100),
        direction: z.enum(['forward', 'backward']).default('backward'),
      }),
    },
    wrap(async (args) => {
      const key = cacheKey('loki_query', args);
      const result = await withCache(key, LOKI_TTL, () => lokiService.queryRange(args));
      return okContent(result, { label: `Loki query (${result.lines.length} lines)` });
    }),
  );

  server.registerTool(
    'loki_search_errors',
    {
      title: 'Loki Search Errors',
      description: 'Tìm log lỗi (error/warn) theo app/service và tuỳ chọn lọc theo shopDomain. Điểm khởi đầu tốt cho RCA.',
      inputSchema: z.object({
        app: z.string().optional().describe('Tên app label, vd: "sama-api"'),
        service: z.string().optional().describe('Tên service label (thay thế cho app)'),
        shop: z.string().optional().describe('Lọc thêm theo shop domain trong nội dung log'),
        level: z.enum(['error', 'warn', 'info']).default('error'),
        ...timeRangeSchema.shape,
        limit: z.number().int().min(1).max(500).default(100),
      }),
    },
    wrap(async (args) => {
      const key = cacheKey('loki_search_errors', args);
      const result = await withCache(key, LOKI_TTL, () => lokiService.searchErrors(args));
      return okContent(result, { label: `Errors (${result.summary.total})` });
    }),
  );

  server.registerTool(
    'loki_trace',
    {
      title: 'Loki Trace',
      description: 'Gom toàn bộ log theo traceId/requestId/correlationId. Xương sống của RCA — trace 1 request qua các service.',
      inputSchema: z.object({
        traceId: z.string().describe('traceId, requestId, hoặc correlationId cần trace'),
        ...timeRangeSchema.shape,
        limit: z.number().int().min(1).max(500).default(200),
      }),
    },
    wrap(async (args) => {
      const key = cacheKey('loki_trace', args);
      const result = await withCache(key, LOKI_TTL, () => lokiService.trace(args));
      return okContent(result, { label: `Trace ${args.traceId} (${result.lines.length} lines)` });
    }),
  );

  server.registerTool(
    'loki_queue_health',
    {
      title: 'Loki Queue Health',
      description: 'Tìm log lỗi RabbitMQ/consumer trong Loki (nack, reject, channel error, no consumer, backlog). Dùng khi phát hiện replica lệch từ mongo_compare_replica.',
      inputSchema: z.object({
        channel: z.string().optional().describe('Tên channel/queue, vd: "recorder-backup", "heatmap"'),
        service: z.string().optional().describe('Tên service (nếu không có channel)'),
        ...timeRangeSchema.shape,
        limit: z.number().int().min(1).max(500).default(200),
      }),
    },
    wrap(async (args) => {
      const key = cacheKey('loki_queue_health', args);
      const result = await withCache(key, LOKI_TTL, () => lokiService.queueHealth(args));
      const hasErrors = result.summary.total > 0;
      return okContent(
        { ...result, diagnosis: hasErrors ? '⚠️ Phát hiện lỗi queue/consumer' : '✅ Không có lỗi queue trong khoảng thời gian này' },
        { label: `Queue health: ${result.summary.total} lỗi` },
      );
    }),
  );

  server.registerTool(
    'loki_labels',
    {
      title: 'Loki Labels',
      description: 'Liệt kê Loki labels hoặc giá trị của 1 label. Dùng để khám phá app/service names trước khi query.',
      inputSchema: z.object({
        name: z.string().optional().describe('Tên label cụ thể để lấy values, vd: "app". Để trống = liệt kê tất cả labels.'),
        ...timeRangeSchema.shape,
      }),
    },
    wrap(async (args) => {
      const result = await lokiService.labels(args);
      return okContent(result);
    }),
  );
}
