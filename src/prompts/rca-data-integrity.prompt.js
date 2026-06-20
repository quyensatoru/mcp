import { z } from 'zod';

export function registerRcaDataIntegrityPrompt(server) {
    server.registerPrompt(
        'rca_data_integrity',
        {
            title: 'RCA: Dữ liệu lệch / Replica drift',
            description:
                'Playbook chẩn đoán lệch dữ liệu giữa api ↔ recorder/heatmap, missing reports',
            argsSchema: z.object({
                domain: z.string(),
                entity: z.enum(['session', 'shop', 'analytic']).optional().default('session'),
                timeRange: z.string().optional(),
            }),
        },
        ({ domain, entity, timeRange }) => ({
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `# RCA: Data Integrity / Replica Drift

**Shop**: ${domain}
**Entity**: ${entity}
${timeRange ? `**Time**: ${timeRange}` : ''}

## Bước 1: Kiểm tra lag tổng thể
\`\`\`
mongo_replica_lag("${domain}")
→ lag_ms: bao nhiêu? > 300000ms (5min) = cờ đỏ
\`\`\`

## Bước 2: Missing report từ Recorder
\`\`\`
mongo_missing_report("${domain}")
→ sessionmissings.count > 0 = shop đã HẾT QUOTA session_limit của plan
  (đây là TÍNH NĂNG thiết kế — khi hết quota, session mới đẩy vào đây thay vì ghi vào DB)
  → KHÔNG phải lỗi consumer. Fix = nâng plan.
  → Đối chiếu với mongo_resolve_shop để xem subscription_info.session_limit.
→ analyticMissing.count > 0 = analytic worker có lỗi (đây mới là vấn đề kỹ thuật)
\`\`\`

## Bước 3: Compare cụ thể
\`\`\`
mongo_compare_replica("${domain}", entity="${entity}", id="<objectId>")
→ MISSING = không có trong recorder → consumer drop
→ STALE = có nhưng fields lệch → consumer xử lý partial
→ IN_SYNC = OK
\`\`\`

## Bước 4: Xác nhận qua log
\`\`\`
loki_queue_health(channel="recorder-backup", start="${timeRange ?? 'now-6h'}")
→ Tìm: nack, reject, channel error, connection drop
\`\`\`

## Bước 5: Analytics drift (nếu entity=analytic)
\`\`\`
mongo_get_analytic("${domain}", dateFrom="<date>", dateTo="<date>")
→ So sánh session.count với đếm thực tế: mongo_count(db="api", collection="sessions", filter={shop:<id>})
\`\`\`

## Kết luận pattern

| Triệu chứng | Root Cause | Fix |
|---|---|---|
| lag > 5min, no missing | Queue chậm (backpressure) | Scale up consumer workers |
| sessionmissings cao | Shop hết quota session_limit (tính năng quota, KHÔNG phải lỗi) | Nâng plan cho shop |
| STALE docs | Partial consumer failure | Check consumer retry logic |
| analyticMissing cao | Analytic aggregation worker lỗi | Check loki_search_errors(app="sama-api", level="error") |`,
                    },
                },
            ],
        }),
    );
}
