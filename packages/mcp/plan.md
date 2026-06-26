# Mida MCP

MCP server (ESM + Express + `@modelcontextprotocol/sdk`) cung cấp bộ công cụ phân tích dữ liệu
chuẩn cho hệ thống Mida, phục vụ `@mida/agent`. Output plain-text, read-only.

## Kiến trúc dữ liệu

```
domain → proxy (chọn shard 1|2)
              ├── api shard 1/2        (nguồn chính: shop, session, pageview, event, behavior, analytic)
              ├── recording shard 1/2  (replica backup + session bị bỏ do vượt quota)
              └── heatmap shard 1/2    (click/move/scroll tổng hợp)
```

- `config/db.config.js` khởi tạo **eager** 7 connection (`Db.Proxy`, `Db.ApiV1/2`, `Db.RecorderV1/2`,
  `Db.HeatmapV1/2`) ngay khi import, `dbReady()` await sẵn sàng lúc start.
- `services/proxy.service.js` → `resolveProxy(domain) → 1|2` (cache Redis 1h). Hàm DUY NHẤT định tuyến shard.
- Mỗi model export object theo shard: `SessionModels = { 1: Db.ApiV1.model(...), 2: Db.ApiV2.model(...) }`.
- Service nhận `proxy` làm tham số đầu rồi index `Models[proxy]`. Tool: `resolveProxy(domain)` → service.

## Bộ công cụ (18 tool)

| Nhóm                      | Tool                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| Shop (bước 0)             | `shop_overview`                                                       |
| Analytics (api)           | `analytics_daily`, `conversion_funnel`                                |
| Session (api)             | `session_list`, `session_detail`, `page_list`, `behavior_events`      |
| Heatmap                   | `heatmap_click`, `heatmap_scroll`, `heatmap_page_insight`             |
| Recording                 | `recording_integrity`, `recording_missing`                            |
| Replay (rrweb/Playwright) | `replay_events`, `replay_render`, `screenshot_url`, `replay_diagnose` |
| Docs                      | `docs_search`                                                         |
| System                    | `ping`                                                                |

Mỗi tool theo shop: `domain` bắt buộc → `resolveProxy` → service (`Models[proxy]`) → cache Redis →
formatter plain-text (co-located trong tool). Lỗi trả `errorContent`. Token/PII bị redact.

## Cấu trúc

```
src/
├── index.js · server.js
├── config/     db(eager) · env · redis
├── middleware/ auth.middleware
├── helpers/    redis · compress · image · slug · format · url · validate · objectid · tool
├── lib/        playwright.js · rrweb-harness.html
├── services/   proxy · shop · analytics · session · heatmap · recording · replay · rrweb · screenshot · docs
├── models/     api/* · recorder/* · heatmap/{click,move,scroll}
├── tools/      index + 8 nhóm tool
├── resources/  mida-doc
└── prompts/    system.prompt
```

## Cần xác nhận

1. **Heatmap field**: model `clickv2`/`movev2`/`scrollv3` đang để `strict:false` + field giả định
   (x,y,counts,selector,device,type/depth). Đối chiếu sample doc thật để chốt formatter.

## Chạy

```sh
pnpm install            # link workspace @mida/*
cp .env.example .env    # điền 7 URI Mongo (bắt buộc) + REDIS_URL + JWT_SECRET
pnpm --filter @mida/mcp start   # http (mặc định) | MCP_TRANSPORT=stdio cho local
pnpm --filter @mida/mcp test
```
