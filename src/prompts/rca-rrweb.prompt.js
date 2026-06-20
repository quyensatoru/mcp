import { z } from 'zod';

export function registerRcaRrwebPrompt(server) {
    server.registerPrompt(
        'rca_rrweb',
        {
            title: 'RCA: Lỗi hiển thị / UI vỡ',
            description:
                'Playbook chẩn đoán lỗi hiển thị qua so sánh rrweb snapshot ↔ live website',
            argsSchema: z.object({
                domain: z.string(),
                sessionId: z.string().optional(),
                compareUrl: z.string().optional().describe('URL trang cần so sánh'),
            }),
        },
        ({ domain, sessionId, compareUrl }) => ({
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `# RCA: Lỗi hiển thị / UI vỡ (rrweb Diagnose)

**Shop**: ${domain}
${sessionId ? `**Session**: ${sessionId}` : ''}
${compareUrl ? `**Compare URL**: ${compareUrl}` : ''}

## Bước 1: Tìm PageView có events
\`\`\`
rrweb_list("${domain}"${sessionId ? `, sessionId="${sessionId}"` : ''})
→ Chọn pageViewId có eventCount > 50 (đủ để render)
\`\`\`

## Bước 2: Xem replay snapshot
\`\`\`
rrweb_render("${domain}", pageViewId="<id>")
→ Screenshot tại cuối session (hoặc atMs cụ thể nếu biết thời điểm lỗi)
→ Quan sát: layout có vỡ không? Content có đúng không?
\`\`\`

## Bước 3: Chụp live
\`\`\`
screenshot_url("${compareUrl ?? 'https://<domain>'}")
→ Screenshot trang thật hiện tại
\`\`\`

## Bước 4: So sánh (nếu cần diff chính xác)
\`\`\`
rrweb_diagnose("${domain}", pageViewId="<id>", compareUrl="${compareUrl ?? 'https://<domain>'}")
→ diffPercent: bao nhiêu %?
→ renderErrors: rrweb có throw lỗi gì không?
→ liveConsoleErrors: browser console errors?
\`\`\`

## Bước 5: Kiểm tra Shopify side (nếu nghi theme)
\`\`\`
shopify_check_embed("${domain}")
→ Script tag có đúng không? Theme có update gần đây không?
\`\`\`

## Interpretation guide

- **diffPercent > 30%** + renderErrors: rrweb events bị corrupt hoặc thiếu events quan trọng
- **diffPercent 10-30%**: content dynamic (giỏ hàng, live chat) — có thể bình thường
- **diffPercent < 10%**: UI bình thường, lỗi có thể ở logic JS (xem behaviors)
- **renderErrors có rrweb exception**: events bị gzip lỗi hoặc version mismatch
- **liveConsoleErrors**: JS lỗi trên storefront hiện tại (có thể do Shopify app conflict)

Sau khi phân tích, kết luận theo format: **Root Cause · Evidence · Fix · Confidence**.`,
                    },
                },
            ],
        }),
    );
}
