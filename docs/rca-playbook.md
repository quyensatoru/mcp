# Mida RCA Playbook

Phương pháp luận Root Cause Analysis cho hệ thống Mida. Dùng cùng với prompt `rca_investigate`.

---

## Pipeline hệ thống (nhớ để suy luận đúng hướng)

```
Storefront (Shopify + Mida script)
    │ rrweb events
    ▼
sama-api → MongoDB api (PRIMARY)
    │        Shop→Visitor→Session→PageView→Event(rrweb)/Behavior / Analytic
    │ RabbitMQ fan-out (post('save') hooks):
    ├──► Recorder (backup replica) + sessionmissings / analytic_missing
    └──► Heatmap (click/move/scroll + Snapshot)
         ↓
    Logs của tất cả → Loki / Grafana
```

---

## Decision tree theo triệu chứng

### "Session không ghi / replay trống"

```
mongo_resolve_shop(domain)
├─ embed_block=true → TẮT embed block
├─ status=false → Shop bị vô hiệu hoá
└─ OK → shopify_check_embed(domain)
         ├─ script tag không tồn tại → Cài lại app embed
         └─ script tag OK → mongo_session_trace(domain, sessionId)
                            ├─ 0 PageView → loki_trace / loki_search_errors
                            │              → ingest API không nhận event
                            └─ có PageView, 0 Event
                               → loki_queue_health (recording consumer)
                               → consumer drop hoặc rrweb script lỗi
```

### "Heatmap trống / Snapshot không có"

```
mongo_resolve_shop(domain)
→ mongo_get_pageviews(domain, sessionId)  -- có PageView không?
  ├─ 0 PageView → xem nhánh "session không ghi"
  └─ có PageView → kiểm tra HM_URI cùng shard
     → mongo_get_snapshot(domain, pageId)
       ├─ không có → loki_queue_health (heatmap channel)
       └─ có → data corrupt? → rrweb_diagnose
```

### "Dữ liệu lệch / Recorder thiếu"

```
mongo_replica_lag(domain)
├─ lag > 5min → queue nghẽn → loki_queue_health
└─ lag OK → mongo_missing_report(domain)
             ├─ sessionMissing > 0 → consumer recorder chết/restart
             └─ OK → mongo_compare_replica(domain, entity, id)
                      ├─ MISSING → consumer drop → loki_queue_health(recorder-backup)
                      └─ STALE → partial failure → check consumer retry logic
```

### "Số liệu analytics sai"

```
mongo_get_analytic(domain, dateFrom, dateTo)
→ so sánh với mongo_count(api, sessions, {shop: <id>})
  ├─ analytic << real count → analytic aggregation worker lỗi
  │   → loki_search_errors(app="sama-api", level="error")
  └─ analytic >> real count → không thể (tăng một chiều)
     → xem analytic_missing từ mongo_missing_report
```

### "UI vỡ / Replay hiển thị sai"

```
rrweb_list(domain, sessionId)
→ chọn pageViewId có eventCount > 50
  → rrweb_render(domain, pageViewId)   -- xem replay
    → screenshot_url(storefront URL)   -- xem live
      → rrweb_diagnose(domain, pageViewId, compareUrl)
        ├─ diffPercent > 30% + renderErrors → events corrupt / thiếu
        ├─ diffPercent 10-30% → content dynamic (bình thường)
        └─ diffPercent < 10% → lỗi logic JS → xem behaviors
           → mongo_get_behaviors(domain, sessionId)
```

### "Shop không thấy app embed / settings sai"

```
shopify_check_embed(domain)
├─ midaScriptFound=false → Cài lại app embed trong Shopify Admin
└─ found → app_api_shop_status(domain)
            → so sánh với mongo_resolve_shop(domain)
              ├─ mismatch settings → sync lỗi giữa Shopify webhook và Mida backend
              └─ OK → issue ở phía Shopify theme (custom liquid overriding embed)
```

---

## Output chuẩn RCA

Sau khi thu thập đủ bằng chứng:

```
## Root Cause
[1-2 câu mô tả nguyên nhân gốc]

## Evidence
- [Log line / số liệu / ảnh diff cụ thể]
- [Tool + kết quả]

## Impact
- [Bao nhiêu shop/session bị ảnh hưởng]
- [Từ khi nào]

## Fix
[Cách khắc phục ngay]

## Prevention
[Cách ngăn tái phát]

## Confidence: HIGH / MEDIUM / LOW
[Lý do mức độ tin cậy]
```

---

## Lưu ý quan trọng

1. **Luôn resolve shard trước**: `mongo_resolve_shop` để tránh đọc nhầm shard → "không thấy dữ liệu" giả.
2. **Loki là nguồn sự thật về queue**: Không có tool RabbitMQ riêng — toàn bộ log consumer/queue đã nằm trong Loki.
3. **Recorder là replica**: Thiếu/lệch ở Recorder ≠ thiếu ở api. Luôn kiểm tra api (primary) trước.
4. **access_token bị redact**: Không bao giờ thấy token trong output — đây là thiết kế cố ý.
5. **rrweb events rất lớn**: `eventLimit` mặc định 1000, tăng lên nếu cần replay đầy đủ.
