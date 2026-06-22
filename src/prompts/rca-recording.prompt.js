import { z } from 'zod';

export function registerRcaRecordingPrompt(server) {
    server.registerPrompt(
        'rca_recording',
        {
            title: 'RCA: Session/Heatmap không ghi',
            description:
                'Playbook chẩn đoán "session không ghi, heatmap trống, replay không có data"',
            argsSchema: {
                domain: z.string().describe('Shopify domain'),
                sessionId: z.string().optional(),
                timeRange: z.string().optional().describe('Khoảng thời gian, vd: "now-2h"'),
            },
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

### 5. Quota check (nếu khách phàn nàn "session không được ghi")
\`\`\`
mongo_missing_report("${domain}")
→ sessionmissings là TÍNH NĂNG QUOTA: khi shop vượt session_limit của plan,
  session mới bị đẩy vào đây thay vì ghi vào DB (thiết kế có chủ đích).
→ sessionMissing.count cao → shop đã HẾT QUOTA, không phải lỗi kỹ thuật.
→ Fix: nâng plan hoặc giải thích cho shop biết đây là giới hạn của gói hiện tại.

mongo_replica_lag("${domain}")
→ lag > 5min → queue nghẽn (vấn đề kỹ thuật thật sự)
\`\`\`

### 6. Queue health (chỉ khi có lag bất thường, KHÔNG phải do quota)
\`\`\`
loki_queue_health(channel="recorder-backup", start="${timeRange ?? 'now-2h'}")
→ Tìm: nack, reject, connection drop, no consumer
\`\`\`

## Decision tree

- embed_block=true → **Fix**: Tắt embed block trong dashboard
- Script tag không tồn tại → **Fix**: Cài lại app embed trong Shopify Admin
- 0 PageView trong DB → **Root cause**: ingest API không nhận events (kiểm tra loki_trace theo requestId từ storefront)
- 0 Event → **Root cause**: recording script lỗi hoặc event consumer drop (xem loki_queue_health)
- sessionmissings cao → **Root cause**: shop hết quota session_limit của plan — nâng plan, KHÔNG phải lỗi consumer
- lag > 5min → **Root cause**: queue nghẽn (số worker không đủ) — đây mới là lỗi kỹ thuật`,
                    },
                },
            ],
        }),
    );
}
