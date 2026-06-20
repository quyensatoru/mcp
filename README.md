# mida-mcp

MCP server cho hệ thống **Mida** — giúp AI tự động làm Root Cause Analysis (RCA) cho issues của app (session không ghi, heatmap trống, replica drift, lỗi hiển thị...).

## Tính năng

| Nhóm tool                    | Số tool | Mô tả                                                           |
| ---------------------------- | ------- | --------------------------------------------------------------- |
| `loki_*`                     | 5       | Trace log, tìm lỗi, chẩn đoán queue (Loki/Grafana)              |
| `mongo_*`                    | 15      | Session trace, replica integrity, analytics (MongoDB read-only) |
| `shopify_*`                  | 3       | Kiểm tra app embed, script tag, theme (Shopify Admin API)       |
| `app_api_*`                  | 2       | Trạng thái shop từ Mida backend                                 |
| `rrweb_*` / `screenshot_url` | 4       | Render rrweb replay, so sánh với live site (Playwright)         |
| `docs_search`                | 1       | Tìm trong tài liệu Mida (MiniSearch)                            |

**Resources**: `mida-doc://index`, `mida-doc://page/{slug}`

**Prompts RCA**: `system_prompt`, `rca_investigate`, `rca_recording`, `rca_data_integrity`, `rca_rrweb`

## Cài đặt

```bash
npm install
npx playwright install chromium   # cần cho rrweb_render / rrweb_diagnose
cp .env.example .env              # điền các URI / token
```

## Cấu hình `.env`

| Biến                                | Bắt buộc | Mô tả                                            |
| ----------------------------------- | -------- | ------------------------------------------------ |
| `MCP_TRANSPORT`                     | ✓        | `http` (remote) hoặc `stdio` (local)             |
| `JWT_SECRET`                        | khi http | Secret ≥ 32 ký tự                                |
| `PROXY_URI`                         |          | MongoDB proxy (shard resolver)                   |
| `API_URI_1` / `API_URI_2`           |          | MongoDB api shard 1/2                            |
| `HM_URI_1` / `HM_URI_2`             |          | MongoDB heatmap shard 1/2                        |
| `RECORDER_URI_1` / `RECORDER_URI_2` |          | MongoDB recorder shard 1/2                       |
| `REDIS_URL`                         |          | Redis (mặc định `redis://localhost:6379`)        |
| `LOKI_URL`                          |          | Grafana Loki endpoint                            |
| `LOKI_TOKEN`                        |          | Bearer token (hoặc dùng `LOKI_USER`+`LOKI_PASS`) |
| `SHOPIFY_API_VERSION`               |          | Mặc định `2024-04`                               |
| `APP_API_BASE_URL`                  |          | Mida backend URL                                 |
| `FIRECRAWL_API_KEY`                 | crawl    | API key Firecrawl                                |
| `MIDA_DOCS_URL`                     | crawl    | URL trang docs để crawl                          |

## Chạy

```bash
# HTTP mode (remote, cần JWT)
npm start

# Stdio mode (local, Claude Desktop / Claude Code)
MCP_TRANSPORT=stdio npm start

# Dev với hot reload
npm run dev
```

## Crawl tài liệu

```bash
npm run crawl:docs    # Firecrawl → data/mida-doc/*.md
npm run docs:index    # Build MiniSearch index → data/mida-doc/index.json
```

## Cấu hình Claude Desktop / Claude Code

Sao chép `.mcp.json.example` → `.mcp.json` và điền đường dẫn tuyệt đối.

## RCA workflow

```
Issue → rca_investigate prompt
  → docs_search (hiểu hành vi đúng)
  → mongo_resolve_shop (xác định shard)
  → loki_search_errors / loki_trace (khoanh vùng log)
  → mongo_session_trace (tìm tầng đứt nếu "không ghi")
  → mongo_compare_replica + mongo_missing_report (drift check)
  → rrweb_diagnose (lỗi hiển thị)
  → shopify_check_embed (phía Shopify)
  → Kết luận: Root Cause · Evidence · Fix · Confidence
```

## Bảo mật

- Tất cả MongoDB connection là **read-only user**
- Whitelist collection theo từng DB, chặn `$out`, `$merge`, `$function`, `$where`
- `access_token` và secrets bị **redact** khỏi mọi output
- App API chỉ cho phép GET và **whitelist path prefix**

## License

ISC
