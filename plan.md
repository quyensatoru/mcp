# Mida MCP — Plan triển khai

> **Mục tiêu**: Xây dựng một MCP server **hoàn chỉnh, mạnh mẽ** cho hệ thống Mida, giúp AI tự
> động **truy vết và phân tích nguyên nhân gốc (Root Cause Analysis - RCA)** cho các issue của
> app, dựa trên: log (Loki/Grafana), dữ liệu MongoDB (read-only), external API (Shopify/App),
> chẩn đoán rrweb snapshot (replay → screenshot → so sánh website thật), và phát hiện **lệch dữ liệu
> giữa api ↔ replica** (recorder/heatmap). _(Chẩn đoán queue/RabbitMQ làm qua log Loki, không tool riêng.)_
> Resource chính là **bộ tài liệu Mida (mida-doc)** được crawl bằng Firecrawl.
>
> Cấu trúc repo bám theo `github.com/quyensatoru/mida-mcp` (ESM + Express + `@modelcontextprotocol/sdk`
>
> - Mongoose đa kết nối + Redis cache + JWT auth/quota), mở rộng thêm các lớp phục vụ RCA.

---

## 0. Tình trạng hiện tại & quyết định nền tảng

| Mục           | Hiện tại                                                 | Quyết định                                                                                  |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Module system | `package.json` đặt `type: commonjs`, `src/index.js` rỗng | **Chuyển sang ESM** (`"type": "module"`) để khớp repo tham chiếu & MCP SDK (ESM-first)      |
| MCP SDK       | chưa có                                                  | `@modelcontextprotocol/sdk` ≥ 1.28 (dùng `McpServer` + `registerTool/Resource/Prompt`)      |
| Transport     | chưa có                                                  | **StreamableHTTP** (remote, qua Express + JWT) + **stdio** (local, cho Claude Desktop/Code) |
| Node          | —                                                        | ≥ 20                                                                                        |
| Validation    | —                                                        | `zod` cho mọi input/output schema                                                           |

> 📌 Đây là greenfield: ta dựng lại từ skeleton, tái sử dụng _pattern_ của repo tham chiếu
> (config đa DB, auth middleware, redis cache, format helper) chứ không bê nguyên code.

---

## 1. Bối cảnh hệ thống Mida (mô hình nguồn dữ liệu cho RCA)

Mida là app analytics/heatmap/session-replay cho Shopify (monorepo: `sama-api`, `sama-hm`,
`sama-recorder`, `sama-cms`, …). Một issue điển hình ("session không ghi",
"heatmap trống", "replay vỡ", "app embed không hiện", "dữ liệu chậm/thiếu/lệch") có thể đến từ
bất kỳ tầng nào trong **pipeline ghi + fan-out replica qua queue**:

```
Storefront (Shopify theme + Mida script)
      │  collect events
      ▼
sama-api (sharded ApiV1 / ApiV2)  ──writes──►  MongoDB api (PRIMARY, source of truth)
      │                                            Shop→Visitor→Session→PageView→Event(rrweb)/Behavior ; Analytic
      │  post('save') hooks publish qua RabbitMQ:
      ├──────►  Recorder (backup replica)  + sessionMissing / analytic_missing  (sama-recorder)
      ├──────►  Heatmap (HeatmapV1/V2: click/move/scroll + Snapshot rrweb)      (sama-hm)
      │
      └──────►  Logs (gồm cả lỗi RabbitMQ / consumer / worker) ──►  Loki / Grafana
```

> 🔑 **Hai insight từ source thật, định hình thiết kế tool:**
>
> 1. **Recorder/Heatmap là replica được feed bằng queue** (qua hook `post('save')` của
>    `Shop/Session/PageView/Page`). Nếu doc có trong api nhưng **thiếu/lệch ở replica** ⇒ consumer
>    queue lỗi ⇒ đây là một nhánh RCA cực phổ biến (đúng như nhận định "recorder là 1 bản replica
>    của api nên đôi lúc lỗi do đó"). `sama-recorder` còn tự ghi `sessionMissing` / `analytic_missing`.
> 2. **Không cần tool RabbitMQ riêng**: toàn bộ log app (gồm lỗi queue/consumer/nghẽn/không consume)
>    đã nằm trong Loki. Chẩn đoán queue = truy vấn Loki, không gọi RabbitMQ Mgmt API.

**Các nguồn AI cần "nhìn" được để làm RCA** → ánh xạ trực tiếp sang tool group:

| Tầng              | Triệu chứng                                   | Nguồn dữ liệu                                            | Tool group               |
| ----------------- | --------------------------------------------- | -------------------------------------------------------- | ------------------------ |
| Log/observability | error, timeout, **queue nghẽn/không consume** | Loki (LogQL) — đã có **toàn bộ** log app gồm cả RabbitMQ | `loki.*`                 |
| Lưu trữ (primary) | thiếu/sai dữ liệu, recording hỏng             | MongoDB api — sharded ApiV1/V2 (đọc)                     | `mongo.*`                |
| Lưu trữ (replica) | **recorder/heatmap lệch so với api**          | MongoDB recorder (backup) + heatmap                      | `mongo.*` (integrity)    |
| Bên thứ ba        | app embed, theme, webhook                     | Shopify Admin API                                        | `shopify.*`              |
| Backend app       | trạng thái shop/setting                       | Mida App API                                             | `app_api.*`              |
| Trải nghiệm thật  | lỗi hiển thị, replay vỡ                       | rrweb `Event`/`Snapshot` + Playwright                    | `rrweb.*`                |
| Tri thức          | "hành vi đúng là gì?"                         | mida-doc (Firecrawl)                                     | resource + `docs_search` |

---

## 2. Kiến trúc MCP server

```
                       ┌──────────────────────────────────────────┐
   MCP Client          │             Express app (index.js)        │
 (Claude / IDE) ──────►│  /mcp  (StreamableHTTP)  + JWT auth/quota  │
                       │  /healthz                                  │
                       └───────────────┬──────────────────────────┘
                                       ▼
                              McpServer (SDK)
              ┌──────────────┬──────────────┬───────────────┐
              ▼              ▼              ▼               ▼
          Resources       Tools          Prompts       (capabilities)
        mida-doc://     loki/mongo/      rca_*
        index|page      shopify/app/
                        rrweb/
                        docs_search
                                       │
                  ┌────────────────────┼─────────────────────┐
                  ▼                    ▼                     ▼
              Services            Helpers/Lib            Config
        (loki, mongo, shard-    (format, validate,   (db: proxy+api+hm
         resolver, replica-      redis, image-diff,    +recorder, redis,
         compare, shopify,       playwright, gunzip)   loki, env)
         app-api, rrweb,
         screenshot, firecrawl/docs)
                  │
          ┌───────┴──────────┬───────────────┬──────────┬──────────┐
          ▼                  ▼               ▼          ▼          ▼
        Loki HTTP   MongoDB (read-only):   Shopify   Mida App  Playwright
        (incl.      Proxy→ApiV1/V2,        Admin API  API      (Chromium)
        queue logs) HeatmapV1/V2, Recorder
```

**Nguyên tắc tách lớp** (giữ giống repo tham chiếu):

- `handler/` — adapter giữa MCP request và service (đăng ký tool/resource/prompt vào `McpServer`).
- `tools/` — mỗi nhóm tool 1 file: định nghĩa **zod schema + mô tả + hàm `register(server)`**.
- `services/` — logic gọi nguồn dữ liệu, không biết gì về MCP.
- `helpers/` — format kết quả gọn cho AI, validate, cache key, parse thời gian.
- `config/` — kết nối & secrets.

---

## 3. Cấu trúc thư mục đề xuất

```
mida-mcp/
├── plan.md                          # tài liệu này
├── package.json                     # ESM, scripts, deps
├── .env.example
├── .mcp.json.example                # cấu hình cho MCP client
├── .gitignore  .prettierrc  .prettierignore  eslint.config.js
├── .husky/                          # pre-commit lint/format
├── docs/
│   └── rca-playbook.md              # ghi chú phương pháp RCA (tham chiếu cho prompt)
├── scripts/
│   ├── crawl-docs.js                # chạy Firecrawl crawl → data/mida-doc/*
│   ├── build-docs-index.js          # tạo index.json + chỉ mục tìm kiếm (MiniSearch)
│   └── install-browser.js           # playwright install chromium (postinstall)
├── data/
│   └── mida-doc/                    # markdown đã crawl + index.json (RAG corpus)
├── src/
│   ├── index.js                     # entry: Express + StreamableHTTP + stdio fallback
│   ├── server.js                    # tạo McpServer + đăng ký tất cả tool/resource/prompt
│   ├── config/
│   │   ├── env.config.js            # đọc & validate env (zod)
│   │   ├── db.config.js             # kết nối Mongoose: Proxy, ApiV1/V2, HeatmapV1/V2, Recorder
│   │   ├── redis.config.js
│   │   └── loki.config.js
│   ├── middleware/
│   │   └── auth.middleware.js       # JWT + quota (giống reference)
│   ├── handler/
│   │   ├── tool.handler.js
│   │   ├── resource.handler.js
│   │   └── prompt.handler.js
│   ├── tools/
│   │   ├── index.js                 # registerAllTools(server)
│   │   ├── loki.tool.js             # gồm cả chẩn đoán queue (đọc log rabbit từ Loki)
│   │   ├── mongo.tool.js            # resolve shop, generic read, session-trace, rrweb data, analytic
│   │   ├── mongo-integrity.tool.js  # replica drift (api↔recorder/heatmap) + missing report
│   │   ├── shopify.tool.js
│   │   ├── app-api.tool.js
│   │   ├── rrweb.tool.js
│   │   └── docs.tool.js             # docs_search
│   ├── resources/
│   │   └── mida-doc.resource.js
│   ├── prompts/
│   │   ├── index.js
│   │   ├── system.prompt.js
│   │   ├── rca-investigate.prompt.js     # orchestrator
│   │   ├── rca-recording.prompt.js       # session/replay/heatmap không ghi (pipeline + rrweb)
│   │   ├── rca-data-integrity.prompt.js  # replica lệch + missing + queue log (Loki)
│   │   └── rca-rrweb.prompt.js           # lỗi hiển thị: snapshot ↔ live
│   ├── services/
│   │   ├── loki.service.js
│   │   ├── mongo.service.js          # CRUD-read tổng quát theo (db, collection)
│   │   ├── shard-resolver.service.js # domain → proxy number → ApiV{n}/HeatmapV{n}
│   │   ├── replica-compare.service.js# so khớp doc giữa api ↔ recorder/heatmap
│   │   ├── shopify.service.js
│   │   ├── app-api.service.js
│   │   ├── rrweb.service.js          # load Event/Snapshot (gunzip) + render headless
│   │   ├── screenshot.service.js     # chụp website thật
│   │   ├── firecrawl.service.js      # crawl (offline)
│   │   ├── docs.service.js           # đọc corpus + search
│   │   └── redis.service.js
│   ├── models/                       # mongoose schemas (read-only), gắn đúng connection
│   │   ├── api/                      # shop, visitor, session, pageview, page, event,
│   │   │                             #   behavior, analytic, plan, setting, integration, module
│   │   ├── heatmap/                  # snapshot, click, move, scroll, hm-session, hm-pageview, metrics
│   │   ├── recorder/                 # session, shop, sessionMissing, analyticMissing
│   │   └── proxy/                    # proxy (shops: domain→proxy)
│   ├── helpers/
│   │   ├── format.helper.js          # rút gọn kết quả cho AI (token budget)
│   │   ├── validate.helper.js        # parse time range, build filter, guard read-only
│   │   ├── redis.helper.js           # cache key SHA-256
│   │   ├── compress.helper.js        # gunzip + base64 cho Event.data / Snapshot.type2
│   │   └── image.helper.js           # pixelmatch diff, encode base64
│   └── lib/
│       ├── playwright.js             # singleton browser pool
│       └── rrweb-harness.html        # trang render rrweb (bundle rrweb-player inline)
└── test/                            # vitest (smoke test cho từng service)
```

---

## 4. Resource: `mida-doc` (Firecrawl)

### 4.1 Pipeline crawl (offline, qua `scripts/crawl-docs.js`)

1. Dùng `@mendable/firecrawl-js`, gọi `crawl(<MIDA_DOCS_URL>, { limit, scrapeOptions: { formats: ['markdown'] }, includePaths, excludePaths })`.
2. Lưu mỗi page thành `data/mida-doc/<slug>.md` (frontmatter: title, url, headings).
3. `build-docs-index.js` sinh `data/mida-doc/index.json` (list page) + chỉ mục **MiniSearch** (lexical) cho `docs_search`.
4. Cron/manual refresh: `npm run crawl:docs`. (Embeddings là tùy chọn nâng cấp v2.)

```js
// scripts/crawl-docs.js (rút gọn)
import FirecrawlApp from '@mendable/firecrawl-js';
const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const res = await app.crawl(process.env.MIDA_DOCS_URL, {
    limit: 500,
    scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
});
// → ghi từng res.data[i].markdown ra data/mida-doc/
```

### 4.2 Đăng ký resource MCP (`resources/mida-doc.resource.js`)

- **Static**: `mida-doc://index` → JSON danh sách trang (slug, title, url, headings).
- **Template**: `mida-doc://page/{slug}` → markdown của trang, kèm `list` callback để client liệt kê.

```js
server.registerResource(
    'mida-doc-index',
    'mida-doc://index',
    { title: 'Mida Docs Index', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, text: docsService.indexJson() }] }),
);

server.registerResource(
    'mida-doc-page',
    new ResourceTemplate('mida-doc://page/{slug}', { list: docsService.listResources }),
    { title: 'Mida Doc Page', mimeType: 'text/markdown' },
    async (uri, { slug }) => ({ contents: [{ uri: uri.href, text: docsService.read(slug) }] }),
);
```

> ⚠️ Model **không tự search resource** → bổ sung **tool `docs_search`** (mục 5.6) để RCA tìm
> đúng trang tài liệu rồi mới đọc resource.

---

## 5. Tool catalog (chi tiết)

> Mỗi tool: **mục đích RCA · input (zod) · output · nguồn · guardrail**. Mọi tool đọc-only,
> có giới hạn (limit/time window), cache Redis theo hash tham số, và trả `isError` kèm gợi ý khi lỗi.

### 5.1 `loki.*` — Trace logger (Loki/Grafana) — **gồm cả chẩn đoán RabbitMQ/queue**

Là điểm khởi đầu của hầu hết RCA: tìm error quanh thời điểm issue, trace theo id. Vì **toàn bộ log
app (kể cả lỗi RabbitMQ/consumer/worker) đã nằm trong Loki**, ta không làm tool RabbitMQ riêng —
chẩn đoán queue = truy vấn Loki.

| Tool                 | Input                                                            | Mô tả                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loki_query`         | `query` (LogQL), `start`, `end`, `limit`, `direction`            | Gọi `/loki/api/v1/query_range`; trả log lines đã parse                                                                                                               |
| `loki_search_errors` | `app/service`, `shop?`, `level=error`, `timeRange`               | Wrapper LogQL `{app="…"} \| level="error"` + filter shop                                                                                                             |
| `loki_trace`         | `traceId\|requestId\|correlationId`, `timeRange`                 | Gom toàn bộ log theo 1 trace (xương sống RCA)                                                                                                                        |
| `loki_queue_health`  | `channel?`(recorder-backup\|heatmap\|…), `service?`, `timeRange` | Wrapper LogQL lọc lỗi RabbitMQ/consumer (connection drop, channel error, nack/reject, "no consumer", backlog/slow-consume). Dùng để xác nhận drift replica từ §5.2.7 |
| `loki_labels`        | `name?`, `timeRange`                                             | Liệt kê label / giá trị label để khám phá namespace/app                                                                                                              |

- **Nguồn**: `LOKI_URL` + auth (Grafana token hoặc basic), header `X-Scope-OrgID` (multi-tenant).
- **Output**: timestamp, labels, line; kèm `summary` (đếm theo level, top error message).
- **Guardrail**: ép `limit` ≤ N, time window mặc định ≤ 24h, từ chối query không có label selector.

### 5.2 `mongo.*` — Data trace (MongoDB, READ-ONLY) ⭐ trọng tâm RCA

Đây là nhóm tool **lớn và quan trọng nhất**. Thiết kế bám sát model thật của Mida (`sama-api`,
`sama-hm`, `sama-recorder`). Mục tiêu: từ một issue, đi dọc **pipeline ghi** và **đối chiếu replica**
để khoanh đúng nơi dữ liệu vỡ.

#### 5.2.0 Topology kết nối (read-only) — MCP mở 6 connection

| Conn           | Env              | Vai trò                                       | Collections chính                                                                                    |
| -------------- | ---------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Proxy**      | `PROXY_URI`      | shard resolver                                | `shops` (chỉ `{ domain, proxy }`)                                                                    |
| **ApiV1**      | `API_URI_1`      | primary data, shard 1                         | toàn bộ collection api (bên dưới)                                                                    |
| **ApiV2**      | `API_URI_2`      | primary data, shard 2                         | (như ApiV1)                                                                                          |
| **HeatmapV1**  | `HM_URI_1`       | heatmap replica + agg, shard 1                | clicks, moves, scrolls, hm-session/pageview, metrics, **snapshots**                                  |
| **HeatmapV2**  | `HM_URI_2`       | heatmap replica + agg, shard 2                | (như HeatmapV1)                                                                                      |
| **RecorderV1** | `RECORDER_URI_1` | **backup replica shard 1 + missing trackers** | sessions, shops, plans, modules, settings, visitor-blocks, **sessionmissings**, **analytic_missing** |
| **RecorderV2** | `RECORDER_URI_2` | **backup replica shard 2**                    | (như RecorderV1)                                                                                     |

**Shard resolution** (bắt buộc trước mọi truy vấn theo shop):
`domain → Proxy.shops.proxy (1\|2) → chọn ApiV{n} & HeatmapV{n}`. Cache kết quả (Redis) để khỏi
hỏi Proxy mỗi lần.

#### 5.2.1 Bản đồ data model (api primary) — để tool & prompt suy luận quan hệ

```
Shop ─┬─ Visitor ─┬─ Session ─┬─ PageView ─┬─ Event     (rrweb replay: type, data[gzip+b64], pageView)
      │           │           │            └─ Behavior  (cart/funnel/ux: type, data, session, pageView)
      │           │           └─ (events[], cart_value, orders, frustrated, ai_summary, duration…)
      │           └─ (os/device/browser/location, ip)
      ├─ Page (address,title,hmEnabled)  ◄── PageView.page
      ├─ Analytic (date, data{visitor,session,order_funnel}, hourArray)   ── tổng hợp ngày
      └─ Plan/Setting/Integration/Module/Survey…
```

- **Shop** (api): `domain, access_token, status, plan_code, subscription_info{session_limit,storage_days},
embed_block, pixel_id, session_count, daily_quota_*, started{view_visitor,view_heatmap}, proxy` →
  trả lời "shop có active/đủ quota/đã cài embed/đúng shard?".
- **rrweb replay** = collection **`Event`** (api): `{ type:Number(rrweb type), data:{compressed}(gzip+b64),
timestamp, pageView }`. **`Behavior`** = sự kiện hành vi (cart/funnel/ux issue).
- **rrweb full snapshot** = collection **`Snapshot`** (HeatmapV{n}): `{ type2:{compressed}(gzip+b64 full DOM),
type4:{href,width,height}, timestamp, device, page }`.
- **Replica fan-out**: hook `post('save')` của `Shop/Session/PageView/Page` publish qua RabbitMQ tới
  Recorder/Heatmap ⇒ nếu replica thiếu/lệch → consumer lỗi (xác nhận bằng Loki).

#### 5.2.2 Tools — nhóm A: Resolve & shop

| Tool                 | Input            | Mô tả                                                                                                                           |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `mongo_resolve_shop` | `domain\|shopId` | Proxy → shard + đọc `Shop` (api): status, plan, quota, embed_block, pixel_id, started, proxy. **Bước 0 của mọi RCA theo shop.** |
| `mongo_shop_health`  | `domain`         | Tổng hợp shop across DB: tồn tại ở api? recorder? heatmap? + `session_count` (field) vs đếm thực tế                             |

#### 5.2.3 Tools — nhóm B: Đọc tổng quát (whitelist, mọi connection)

| Tool              | Input                                                                                                     | Mô tả                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `mongo_find`      | `db`(api\|heatmap\|recorder), `collection`(whitelist), `filter`, `projection`, `sort`, `limit`, `domain?` | Truy vấn đọc; auto-resolve shard từ `domain`                    |
| `mongo_aggregate` | `db`, `collection`, `pipeline` (chặn `$out/$merge/$function/$where`)                                      | Aggregation đọc                                                 |
| `mongo_count`     | `db`, `collection`, `filter`, `domain?`                                                                   | Đếm (estimated/exact) — nhanh để xác minh "có/không có dữ liệu" |

#### 5.2.4 Tools — nhóm C: Trace pipeline session (xương sống RCA dữ liệu)

| Tool                  | Input                             | Mô tả                                                                                                                                                                 |
| --------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mongo_session_trace` | `domain`, `sessionKey\|sessionId` | Đi dọc **Session → PageView(s) → Event/Behavior**, trả **đếm ở từng tầng** + cờ chỗ đứt (vd: có Session nhưng 0 PageView; có PageView nhưng 0 Event ⇒ recording hỏng) |
| `mongo_get_session`   | `domain`, `sessionKey\|sessionId` | Session doc đầy đủ + Visitor liên kết                                                                                                                                 |
| `mongo_get_pageviews` | `domain`, `sessionId`             | Danh sách PageView của session (href, page_type, theme_template, start/end_time)                                                                                      |
| `mongo_get_behaviors` | `domain`, `sessionId\|pageViewId` | Behavior (cart/funnel/ux issue) theo session/pageView                                                                                                                 |

#### 5.2.5 Tools — nhóm D: Dữ liệu rrweb (cấp nguồn cho `rrweb.*` ở §5.5)

| Tool                 | Input                            | Mô tả                                                                                                  |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `mongo_get_events`   | `domain`, `pageViewId`, `limit?` | Đọc `Event` theo pageView, **giải nén gzip+b64** (`compress.helper`) → mảng rrweb events sẵn để replay |
| `mongo_get_snapshot` | `domain`, `pageId`               | Đọc `Snapshot` (HeatmapV{n}), giải nén `type2` → full DOM snapshot + `type4{href,w,h}`                 |

#### 5.2.6 Tools — nhóm E: Analytics

| Tool                 | Input                          | Mô tả                                                                                                                           |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `mongo_get_analytic` | `domain`, `dateFrom`, `dateTo` | `Analytic` theo ngày: visitor/session counts, order_funnel, bounce/conversion_rate — đối chiếu "số liệu có cộng dồn đúng không" |

#### 5.2.7 Tools — nhóm F: Toàn vẹn dữ liệu & replica drift ⭐ (đáp ứng yêu cầu recorder)

| Tool                    | Input                                                            | Mô tả                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `mongo_compare_replica` | `domain`, `entity`(session\|shop\|pageview\|analytic), `id\|key` | So doc giữa **api (nguồn)** ↔ **recorder/heatmap**: báo _missing / stale (lệch updatedAt) / field-diff_. Phát hiện "recorder lệch" |
| `mongo_missing_report`  | `domain`, `dateFrom?`, `dateTo?`                                 | Đọc `sessionmissings` + `analytic_missing` (Recorder) — chính hệ thống đã tự đánh dấu cái gì thiếu                                 |
| `mongo_replica_lag`     | `domain`                                                         | Ước lượng độ trễ replica: so `last_active`/`createdAt` mới nhất của session ở api vs recorder/heatmap                              |

> 🔗 Khi nhóm F phát hiện drift → **chuyển sang `loki.*`** truy vấn log consumer/queue tương ứng
> (`recorder-backup`, `heatmap` channel) để xác nhận nguyên nhân (consumer chết/nghẽn).

#### 5.2.8 Guardrail an toàn (bắt buộc)

- Kết nối bằng **user chỉ có quyền `read`** (ưu tiên trỏ secondary/replica của từng DB).
- **Whitelist collection theo từng `db`**; chặn stage ghi (`$out`, `$merge`), `$function`, `$where`, JS.
- `maxTimeMS`, `limit` cap (mặc định ≤ 100, hard-cap), **bắt buộc `projection`** cho collection nặng
  (`Event`, `Snapshot`, `clicks/moves/scrolls`); riêng `Event/Snapshot` chỉ trả raw khi đi qua nhóm D.
- Mọi tool theo shop **phải resolve shard trước** (tránh đọc nhầm shard ⇒ "không thấy dữ liệu" giả).
- Không bao giờ trả `access_token` của Shop trong output (redact).

### 5.3 `shopify.*` — External API (Shopify Admin)

Trả lời "issue có nằm ở phía Shopify không?" (app embed, theme, webhook, script tag).

| Tool                  | Input                              | Mô tả                                                    |
| --------------------- | ---------------------------------- | -------------------------------------------------------- |
| `shopify_graphql`     | `shopDomain`, `query`, `variables` | Proxy GraphQL Admin API (token resolve từ DB)            |
| `shopify_rest`        | `shopDomain`, `path`, `method=GET` | Proxy REST (ưu tiên GET)                                 |
| `shopify_check_embed` | `shopDomain`                       | Kiểm tra app embed/script tag Mida có active trong theme |

- **Guardrail**: chỉ scope đọc; rate-limit handling (Shopify cost/bucket); không log token.

### 5.4 `app_api.*` — Mida App backend API

Đối chiếu trạng thái app cho 1 shop (health, settings, feature flags).

| Tool                  | Input                                      | Mô tả                                                    |
| --------------------- | ------------------------------------------ | -------------------------------------------------------- |
| `app_api_call`        | `path` (whitelist), `method=GET`, `params` | Gọi backend Mida nội bộ (đọc)                            |
| `app_api_shop_status` | `shopDomain`                               | Tổng hợp trạng thái shop (cài đặt, gói, ingest enabled?) |

### 5.5 `rrweb.*` — Chẩn đoán snapshot (mạnh nhất, phức tạp nhất)

Replay session từ snapshot trong DB → render headless → screenshot → **so sánh website thật** →
để AI suy đoán lỗi hiển thị/JS.

> Hai nguồn rrweb (xem §5.2.1): **replay** = `Event` (api, theo `pageView`); **full snapshot** =
> `Snapshot` (HeatmapV{n}, theo `page`). Cả hai nén gzip+b64 → giải nén qua `compress.helper`.

| Tool             | Input                                                             | Output             | Mô tả                                                                 |
| ---------------- | ----------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `rrweb_list`     | `domain`, `sessionId?`, `timeRange?`                              | danh sách          | Liệt kê PageView (có Event) / Snapshot khả dụng để replay             |
| `rrweb_render`   | `domain`, `sessionId\|pageViewId`, `atMs?` (mốc/last/error-frame) | **image** + meta   | `mongo_get_events` → Replayer trong Playwright → seek → screenshot    |
| `screenshot_url` | `url`, `viewport?`, `waitFor?`                                    | **image**          | Chụp website thật (storefront/page cụ thể)                            |
| `rrweb_diagnose` | `domain`, `sessionId\|pageViewId`, `compareUrl`, `atMs?`          | 2 image + **diff** | Render snapshot **và** chụp live → pixelmatch diff + console/DOM diff |

**Cơ chế render rrweb headless** (`rrweb.service.js` + `lib/rrweb-harness.html` + `lib/playwright.js`):

1. `lib/rrweb-harness.html`: trang tĩnh nhúng sẵn `rrweb-player` (bundle inline, **không CDN runtime**),
   expose `window.renderEvents(events, atMs)` để dựng Replayer và seek tới mốc thời gian.
2. Playwright (Chromium headless) mở harness (file://), `page.evaluate(renderEvents, {events, atMs})`.
3. Đợi replay ổn định → `locator('.replayer-wrapper').screenshot()` → PNG buffer.
4. Trả về dưới dạng **MCP image content** (`{ type: 'image', data: base64, mimeType: 'image/png' }`)
    - lưu file vào temp dir, trả kèm path & metadata (errors trong replay, console messages).
5. `rrweb_diagnose`: chạy (2)–(4) cho snapshot + `screenshot_url` cho live → `image.helper`
   dùng **pixelmatch + pngjs** sinh ảnh diff & % khác biệt; gom console error 2 bên cho AI đối chiếu.

- **Lưu ý dữ liệu**: rrweb events có thể rất lớn → stream/giới hạn theo `atMs`, nén khi truyền vào page;
  browser dùng **pool singleton** (`lib/playwright.js`) tránh cold-start mỗi call.
- **Guardrail**: timeout render, kích thước ảnh giới hạn, domain `compareUrl` phải khớp shop.

### 5.6 `docs_search` — Tìm trong mida-doc

| Tool          | Input            | Mô tả                                                                     |
| ------------- | ---------------- | ------------------------------------------------------------------------- |
| `docs_search` | `query`, `topK?` | MiniSearch lexical trên corpus → trả slug+title+đoạn trích + URI resource |

---

## 6. Prompts cho RCA

Prompt mã hoá **phương pháp luận RCA** để AI dùng tool đúng thứ tự, thu thập bằng chứng và kết luận
có cơ sở (giả thuyết → xác minh bằng tool → chuỗi bằng chứng → 5 Whys → confidence + remediation).

| Prompt               | Args                                                        | Vai trò                                                                                                                                        |
| -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `system_prompt`      | —                                                           | Hành vi tổng thể của assistant (giống reference) + nguyên tắc đọc-only, redact token, dẫn nguồn                                                |
| `rca_investigate`    | `issue`, `shopDomain?`, `sessionId?`, `timeRange?`, `area?` | **Orchestrator chính**: kế hoạch điều tra đa tầng (xem §7)                                                                                     |
| `rca_recording`      | `shopDomain`, `sessionId?`, `timeRange`                     | Playbook "session/replay/heatmap không ghi": `mongo_session_trace` → tìm tầng đứt (Session/PageView/Event) → `mongo_get_events` + `loki_trace` |
| `rca_data_integrity` | `shopDomain`, `entity?`, `timeRange`                        | Playbook **replica lệch**: `mongo_compare_replica` + `mongo_missing_report` → `loki_queue_health` xác nhận consumer (recorder/heatmap)         |
| `rca_rrweb`          | `shopDomain`, `sessionId`, `compareUrl`                     | Playbook lỗi hiển thị/frontend qua so sánh snapshot↔live (`rrweb_diagnose`)                                                                    |

Mỗi prompt khuyến nghị: bắt đầu bằng `docs_search` để lấy "hành vi đúng", **`mongo_resolve_shop`**
để xác định shard, sau đó dùng tool theo khu vực nghi ngờ, **trích dẫn evidence (log line / số đếm
mongo / ảnh diff)**, gán **độ tin cậy** và đề xuất khắc phục + cách phòng ngừa.

---

## 7. Luồng RCA end-to-end (`rca_investigate`)

```
Issue  ─►  [1] docs_search            → hiểu hành vi kỳ vọng
       ─►  [2] mongo_resolve_shop      → shard + trạng thái/quota/embed của shop
       ─►  [3] loki_trace / search_errors → khoanh vùng lỗi quanh timeRange
       ─►  rẽ nhánh theo triệu chứng:
            ├─ không ghi?    → mongo_session_trace (tìm tầng đứt) + mongo_get_events + loki_trace
            ├─ replica lệch? → mongo_compare_replica + mongo_missing_report → loki_queue_health
            ├─ số liệu sai?  → mongo_get_analytic / mongo_aggregate (đối chiếu kỳ vọng)
            ├─ hiển thị vỡ?  → rrweb_diagnose (snapshot ↔ live) + screenshot_url
            └─ phía Shopify? → shopify_check_embed / shopify_graphql + app_api_shop_status
       ─►  [4] Tổng hợp: chuỗi nhân-quả + bằng chứng + confidence + remediation
```

Output chuẩn của AI: **Root cause · Evidence (kèm nguồn) · Impact · Fix · Prevention · Confidence**.

---

## 8. Vấn đề xuyên suốt (cross-cutting)

- **Config/env** (`config/env.config.js`, validate bằng zod). Bảng `.env.example`:

| Nhóm                             | Biến                                                              |
| -------------------------------- | ----------------------------------------------------------------- |
| Server                           | `PORT`, `JWT_SECRET`, `MCP_TRANSPORT=http\|stdio`                 |
| Mongo (sharded, read-only)       | `PROXY_URI`, `API_URI_1`, `API_URI_2`, `HM_URI_1`, `HM_URI_2`     |
| Mongo (recorder backup, 2 shard) | `RECORDER_URI_1`, `RECORDER_URI_2`                                |
| Redis                            | `REDIS_URL`, `CACHE_TTL`                                          |
| Loki                             | `LOKI_URL`, `LOKI_TOKEN` / `LOKI_USER`+`LOKI_PASS`, `LOKI_ORG_ID` |
| Shopify                          | `SHOPIFY_API_VERSION` (token/shop resolve từ DB)                  |
| App API                          | `APP_API_BASE_URL`, `APP_API_TOKEN`                               |
| Firecrawl                        | `FIRECRAWL_API_KEY`, `MIDA_DOCS_URL`                              |

- **Auth & quota**: JWT middleware + giới hạn quota/tenant (bê pattern reference).
- **Cache**: Redis, key = SHA-256(toolName + params), TTL cấu hình; TTL ngắn cho tool gần realtime
  (`loki_*`, `mongo_replica_lag`), cache lâu cho `docs_*` và resolve shard.
- **Safety đọc-only**: Mongo read replica + whitelist; external API ưu tiên GET; không bao giờ log secret/token.
- **Image handling**: trả MCP image content (base64) + lưu temp; giới hạn kích thước.
- **Logging**: `pino` structured; (tuỳ chọn) đẩy log của chính MCP vào Loki để self-observability.
- **Format cho AI**: `format.helper` rút gọn để tiết kiệm token (top-N, tóm tắt, bỏ field thừa).
- **Error UX**: tool trả `{ isError: true, content:[{type:'text', text: gợi ý khắc phục}] }`.

---

## 9. Dependencies (đề xuất)

```jsonc
// dependencies
"@modelcontextprotocol/sdk", "express", "zod", "mongoose", "ioredis",
"jsonwebtoken", "undici",            // hoặc axios cho HTTP client
"@mendable/firecrawl-js",            // crawl docs (offline)
"playwright",                        // render rrweb + chụp web thật (chromium)
"pixelmatch", "pngjs",               // image diff
"minisearch",                        // docs_search lexical
"dotenv", "pino"
// devDependencies
"vitest", "eslint", "prettier", "husky"
```

`package.json` cần đổi `"type": "module"`, thêm scripts: `start`, `dev`, `crawl:docs`,
`docs:index`, `postinstall` (playwright install chromium), `lint`, `format`, `test`.

---

## 10. Lộ trình triển khai (theo phase)

> Mỗi phase tự chạy được & test riêng. Ưu tiên giá trị RCA sớm: Docs → Loki → Mongo (gồm integrity),
> external API; rrweb (nặng) sau cùng.

- [x] **P0 — Scaffold**: ESM, deps, `config/env`, `server.js`, transport HTTP+stdio, auth, `/healthz`,
      đăng ký 1 tool "ping" để verify end-to-end với MCP client. Tạo `.mcp.json.example`, ESLint/Prettier/Husky.
- [x] **P1 — Docs resource**: `crawl-docs.js` + `build-docs-index.js` + `docs.service` + resource
      `mida-doc://` + tool `docs_search`.
- [x] **P2 — Loki tools**: `loki.service` + 5 tool (gồm `loki_queue_health`) + format/summary + cache.
- [x] **P3a — Mongo nền**: `config/db.config` (8 connection) + `shard-resolver.service` + models +
      guardrail đọc-only + nhóm A/B (`resolve_shop`, `shop_health`, `find/aggregate/count`).
- [x] **P3b — Mongo pipeline + rrweb data**: nhóm C (`session_trace`, getters) + nhóm D
      (`get_events`/`get_snapshot` + `compress.helper`) + nhóm E (`get_analytic`).
- [x] **P3c — Mongo integrity** ⭐: `replica-compare.service` + nhóm F (`compare_replica`,
      `missing_report`, `replica_lag`) — kết nối Recorder/Heatmap.
- [x] **P4 — External API**: `shopify.*` (resolve token từ DB) + `app_api.*`.
- [x] **P5 — rrweb diagnose**: `lib/playwright` pool + `rrweb-harness.html` + render + `screenshot_url`
    - `rrweb_diagnose` (pixelmatch diff). (Phase nặng nhất; tiêu thụ nhóm D của P3b.)
- [x] **P6 — Prompts RCA**: `system` + `rca_investigate` + `rca_recording` + `rca_data_integrity`
    - `rca_rrweb`.
- [x] **P7 — Hoàn thiện**: thêm `rrweb` vào deps, fix static imports, mark phases done.

---

## 11. Câu hỏi cần xác nhận (open questions)

1. **URL tài liệu Mida** để Firecrawl crawl (help center / docs.getmida...?) và phạm vi `includePaths`?
2. **Loki**: endpoint, cách auth (Grafana Cloud token vs basic), có multi-tenant `X-Scope-OrgID` không?
   Tên label chuẩn (`app`/`service`/`shop`/`traceId`) và **label phân biệt consumer/channel**
   (`recorder-backup`/`heatmap`) để `loki_queue_health` lọc đúng?
3. **MongoDB (đã biết topology từ source: Proxy→ApiV1/V2, HeatmapV1/V2, Recorder backup)**:
   cần URI prod thật + **user chỉ-đọc / secondary** cho từng cluster. Production có đúng 2 shard (V1/V2)
   hay nhiều hơn? Có cần kết nối **ClickHouse** (`USE_CLICKHOUSE`) trong v1?
4. **Recorder/replica**: ngưỡng coi là "lệch" (`replica_lag` bao nhiêu giây là bất thường)? Có field
   `updatedAt` đồng bộ giữa api ↔ recorder để so `stale` không?
5. **Shopify**: token Admin API lưu ở `Shop.access_token` (đã thấy) — scope hiện có đủ đọc theme/script tag?
6. **App API nội bộ**: base URL + cách auth + endpoint nào an toàn để expose (whitelist)?
7. **Triển khai**: chạy remote (StreamableHTTP sau gateway) hay local stdio cho từng dev? Ảnh hưởng auth.
8. **docs_search**: lexical (MiniSearch) đủ cho v1, hay cần embeddings ngay (thêm provider/secret)?

---

## 12. Tài liệu tham khảo

- MCP TypeScript SDK — server guide: <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md>
- Loki HTTP API (`query_range`/LogQL): <https://grafana.com/docs/loki/latest/reference/loki-http-api/>
- rrweb replay docs: <https://github.com/rrweb-io/rrweb/blob/master/docs/replay.md>
- Firecrawl crawl endpoint: <https://www.firecrawl.dev/blog/mastering-the-crawl-endpoint-in-firecrawl> · SDK: <https://www.npmjs.com/package/@mendable/firecrawl-js>
- Repo tham chiếu cấu trúc: <https://github.com/quyensatoru/mida-mcp>

```

```
