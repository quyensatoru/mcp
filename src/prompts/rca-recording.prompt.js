import { z } from 'zod';

export function registerRcaRecordingPrompt(server) {
    server.registerPrompt(
        'rca_recording',
        {
            title: 'RCA: Session/Heatmap không ghi',
            description:
                'Playbook chẩn đoán "session không ghi, heatmap trống, replay không có data"',
            argsSchema: z.object({
                domain: z.string().describe('Shopify domain'),
                sessionId: z.string().optional(),
                timeRange: z.string().optional().describe('Khoảng thời gian, vd: "now-2h"'),
            }),
        },
        ({ domain, sessionId, timeRange }) => ({
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `# RCA: Session/Heatmap không ghi

**Shop**: ${domain}
${sessionId ? `**Session**: ${sessionId}` : ''}
${timeRange ? `**Time**: ${timeRange}` : ''}

## Playbook (thực hiện đúng thứ tự)

### 1. Baseline
\`\`\`
mongo_resolve_shop("${domain}")
→ Kiểm tra: status=true, embed_block=false, plan có session_limit đủ không?
\`\`\`

### 2. Shopify side
\`\`\`
shopify_check_embed("${domain}")
→ Kiểm tra: script tag Mida có tồn tại trong theme không?
\`\`\`

### 3. Session trace (nếu có sessionId cụ thể)
\`\`\`
mongo_session_trace("${domain}", sessionId="${sessionId ?? '<sessionId>'}")
→ Xem pipeline: Session? → PageView? → Event?
→ counts.pageviews === 0 → vấn đề ở ingest/queue
→ counts.events === 0 → vấn đề ở recording script hoặc event consumer
\`\`\`

### 4. Log errors
\`\`\`
loki_search_errors(app="sama-api", shop="${domain}", start="${timeRange ?? 'now-2h'}")
→ Tìm lỗi liên quan đến shop này
\`\`\`

### 5. Recorder integrity
\`\`\`
mongo_missing_report("${domain}")
→ sessionMissing > 0 → recorder consumer drop data
mongo_replica_lag("${domain}")
→ lag > 5min → queue nghẽn
\`\`\`

### 6. Queue health (nếu phát hiện drift/missing)
\`\`\`
loki_queue_health(channel="recorder-backup", start="${timeRange ?? 'now-2h'}")
→ Tìm: nack, reject, connection drop, no consumer
\`\`\`

## Decision tree

- embed_block=true → **Fix**: Tắt embed block trong dashboard
- Script tag không tồn tại → **Fix**: Cài lại app embed trong Shopify Admin
- 0 PageView trong DB → **Root cause**: ingest API không nhận events (kiểm tra loki_trace theo requestId từ storefront)
- 0 Event → **Root cause**: recording script lỗi hoặc event consumer drop (xem loki_queue_health)
- sessionMissing cao → **Root cause**: recorder consumer down
- lag > 5min → **Root cause**: queue nghẽn (số worker không đủ)`,
                    },
                },
            ],
        }),
    );
}
