import { z } from 'zod';

export function registerRcaInvestigatePrompt(server) {
    server.registerPrompt(
        'rca_investigate',
        {
            title: 'RCA: Điều tra tổng quát',
            description:
                'Orchestrator RCA: từ mô tả issue → lập kế hoạch điều tra đa tầng → gọi tool → kết luận',
            argsSchema: {
                issue: z
                    .string()
                    .describe('Mô tả issue, vd: "shop abc.myshopify.com không ghi session"'),
                domain: z.string().optional().describe('Shopify domain nếu biết'),
                sessionId: z.string().optional().describe('Session ID nếu có'),
                timeRange: z
                    .string()
                    .optional()
                    .describe('Khoảng thời gian, vd: "last 2 hours", "2024-01-15"'),
                area: z
                    .enum(['recording', 'heatmap', 'analytics', 'replay', 'shopify', 'unknown'])
                    .optional(),
            },
        },
        ({ issue, domain, sessionId, timeRange, area }) => ({
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `# RCA Investigation

**Issue**: ${issue}
${domain ? `**Shop**: ${domain}` : ''}
${sessionId ? `**Session**: ${sessionId}` : ''}
${timeRange ? `**Time**: ${timeRange}` : ''}
${area ? `**Area**: ${area}` : ''}

## Quy trình điều tra (thực hiện theo thứ tự)

### Bước 1: Hiểu hành vi kỳ vọng
Dùng \`docs_search\` với từ khoá liên quan đến issue để tìm tài liệu mô tả hành vi đúng.

### Bước 2: Xác định shop & shard
${domain ? `Dùng \`mongo_resolve_shop("${domain}")\` để xác định shard, plan, trạng thái, embed_block.` : 'Nếu chưa có domain, hỏi người dùng hoặc dùng loki_search_errors để tìm domain từ log.'}

### Bước 3: Khoanh vùng qua log
Dùng \`loki_search_errors\` và/hoặc \`loki_trace\` để tìm lỗi quanh thời điểm issue.

### Bước 4: Rẽ nhánh theo triệu chứng

${
    area === 'recording' || !area
        ? `
**Nếu "session/heatmap không ghi"**:
1. \`mongo_session_trace(domain, sessionId)\` → tìm tầng đứt (Session/PageView/Event)
2. Nếu 0 PageView: \`shopify_check_embed\` → embed có active không?
3. Nếu có PageView nhưng 0 Event: \`loki_trace\` → tìm lỗi ingest
4. \`mongo_compare_replica\` + \`mongo_missing_report\` → recorder có thiếu không?
`
        : ''
}

${
    area === 'replay' || !area
        ? `
**Nếu lỗi hiển thị/replay**:
1. \`rrweb_list(domain, sessionId)\` → kiểm tra có events không
2. \`rrweb_render(domain, pageViewId)\` → render snapshot
3. \`screenshot_url(compareUrl)\` → chụp live
4. \`rrweb_diagnose\` → so sánh diff
`
        : ''
}

${
    area === 'analytics' || !area
        ? `
**Nếu số liệu sai/thiếu**:
1. \`mongo_get_analytic(domain, dateFrom, dateTo)\` → xem data thực tế
2. \`mongo_replica_lag(domain)\` → recorder có lag không?
3. \`loki_queue_health\` → consumer có lỗi không?
`
        : ''
}

### Bước 5: Tổng hợp
Sau khi thu thập đủ bằng chứng, viết output chuẩn:
- **Root Cause** · **Evidence** · **Impact** · **Fix** · **Prevention** · **Confidence**`,
                    },
                },
            ],
        }),
    );
}
