# @mida/orchestrator

Một **MCP gateway mỏng** — bọc ngoài các **MCP server hạ tầng** của hệ thống Mida (mỗi RabbitMQ,
Redis, Mongo... chạy MCP server riêng). Orchestrator gom (aggregate) tool của chúng lên cho agent
qua **một** MCP duy nhất, cộng guard "trần năng lực" + router chọn cụm.

**Phạm vi hẹp:** orchestrator **không** có tool liên quan tới knowledge, **không** có tool để Claude
Code inject context. Nó chỉ điều phối/chuyển tiếp. `@mida/knowledge` là MCP **riêng, độc lập**
(agent gọi song song, không đi qua orchestrator). `mida-rca` **không liên quan** tới feature này.

---

## 1. Mục tiêu & phạm vi

| Có làm                                                         | Không làm                                            |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| Đăng ký / kết nối / discovery các infra MCP (đa cụm)           | Lưu trữ tri thức, recall, inject → `@mida/knowledge` |
| Aggregate + namespace tool downstream lên agent (plugin all)   | Quyết định hỏi-phép người dùng → Agent SDK (đã có)   |
| Guard trần năng lực (read/write/admin), mỏng, defense-in-depth | Workflow debug / pipeline summary → `mida-skills`    |
| Router chọn cụm khi có nhiều instance cùng loại                | Bất cứ thứ gì "nhớ lâu" — không state nghiệp vụ      |

Nguyên tắc: **càng mỏng càng tốt**. Không giữ state nghiệp vụ, không capture. Vào → guard → route →
forward → ra.

---

## 2. Vị trí trong monorepo

```
                 ┌──────────────────────────┐   MCP client   ┌─ rabbit-mcp  (prod | staging)
@mida/agent ────▶│  @mida/orchestrator      │───────────────▶├─ redis-mcp   (cache | queue)
   │  (mcpServers │  gateway: guard + route  │                └─ mongo-mcp   (shard1 | shard2)
   │   config)    └──────────────────────────┘
   │
   └────────────▶ @mida/knowledge (MCP riêng: get_knowledge / save_knowledge)
```

- Agent khai báo **2 MCP độc lập** trong `claude-config`: `orchestrator` và `knowledge`
  (giống cách khai báo mcpServer hiện có, `packages/claude-config/src/constant/defaults.constant.js`).
- Agent **không** gọi thẳng infra MCP — chỉ qua orchestrator. Nhưng gọi knowledge **trực tiếp**.

---

## 3. Kiến trúc: Gateway/Aggregator (thin)

Hai vai, transport như các MCP khác trong repo (HTTP + JWT stateless, hoặc `stdio` local):

1. **Server (với agent):** `createMcpServer()` đăng ký:
    - **Aggregated tools** — proxy toàn bộ tool downstream, đã namespace (ý "plugin all tool").
    - **Introspection tools** — `targets_list`, `catalog_list`, `ping`. (Chỉ vậy — không có tool
      nghiệp vụ nào khác.)
2. **Client (với downstream):** registry giữ pool MCP client
   (`@modelcontextprotocol/sdk/client`), `tools/list` lấy catalog, `tools/call` forward.

> `// ponytail: P0 downstream chạy stdio child-process; lên HTTP khi cần multi-host`

---

## 4. Quyết định #1 — Guard đặt ở đâu (đã nghiên cứu)

**Nhận định của bạn đúng.** Với kiến trúc "mỗi infra là 1 MCP nhỏ", permission chia 3 mức, mỗi mức
đúng một nơi:

| Mức                           | Nơi xử lý                                | Cơ chế                                                     |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| Trần năng lực THẬT (read)     | **từng infra MCP nhỏ** (env/creds riêng) | rabbit-mcp/redis-mcp tự connect bằng user scope-hẹp        |
| Trần năng lực phụ (bọc ngoài) | **orchestrator guard** (mỏng)            | `capability: read/write/admin` per-target, mặc định `read` |
| Quyết định cấp phép + hỏi     | **Agent SDK** (host chung)               | `canUseTool` / `disallowedTools` / PreToolUse hook         |

- **Read floor thật nằm ở mỗi MCP nhỏ** — đúng ý "config env cho mcp set quyền read". Ví dụ redis-mcp
  chỉ cấp lệnh GET/SCAN nếu creds/config của nó read-only. Orchestrator không thay thế được điều này.
- **Agent SDK giữ quyết định cấp phép** — đã build sẵn, dùng chung cho mọi MCP (kể cả knowledge):
  `buildAgentOptions` (`packages/claude-config/src/config.js`) + `buildCanUseTool`
  (`packages/agent/src/claude/mattermost.claude.js`): read-only auto-allow theo `READ_ONLY_REGEX`,
  update/delete hỏi yes/no, `disallowedTools` chặn sẵn nhóm nguy hiểm.
- **Guard orchestrator chỉ là cầu dao cứng phụ** — vì gateway forward được cả lệnh ghi (publish/set/
  purge). Mặc định `read`; nâng `write`/`admin` là thay đổi config có chủ đích. Không thừa cho lệnh
  huỷ, nhưng **không** tự dựng cơ chế hỏi-phép riêng (tránh 2 nguồn sự thật).

### Điều kiện kỹ thuật — Namespacing giữ động từ

Agent thấy `mcp__<server>__<local>`; `canUseTool` lấy `.split('__').pop()` để test read/write. Nên
tên local **phải giữ động từ ở segment cuối**:

```
downstream "rabbit-prod" tool "queue_publish"
  → local:  rabbit_prod__queue_publish       (─ → _ ; __ ngăn giữa target và tool)
  → agent:  mcp__orchestrator__rabbit_prod__queue_publish
  → .pop() = "queue_publish" → READ_ONLY_REGEX không match → SDK hỏi phép ✅
  → disallowedTools "mcp__orchestrator__*__*purge*" vẫn match ✅
```

Guard dùng chung `READ_ONLY_REGEX` (`packages/claude-config/src/constant/defaults.constant.js`) để
phân loại → **một định nghĩa read/write duy nhất** cho cả guard lẫn SDK.

---

## 5. Registry đa cụm + Router

Một downstream định danh `(kind, cluster)`.

- **Registry** (`registry/registry.js`): đọc `McpTarget` từ Mongo → target `enabled` thì mở client,
  `tools/list`, cache catalog. Map `name → { client, tools, capability }`.
- **Router** (`router/router.js`): khi cần chọn cụm (nhiều rabbit), resolve theo hint. P0 chọn tường
  minh qua tham số (`cluster:"prod"`) hoặc target mặc định mỗi kind; P1 rule + cache Redis.
  `// ponytail: explicit-first, resolver sau`.

### Cấu hình đa kết nối — mở rộng N instance mỗi kind

Yêu cầu: `mongo_uri` có **nhiều** connection string; rabbit, redis cũng vậy. Thiết kế sao cho thêm
một instance là **thêm dữ liệu, không sửa code/schema** — tránh kiểu hardcode `URI_1/URI_2` của
mida-rca cũ (không mở rộng được).

**Nguồn sự thật runtime = `McpTarget` docs.** N doc cùng `kind`, khác `cluster` = N instance. Thêm
cụm = thêm 1 doc. **Mỗi connection string = 1 process infra MCP riêng** (N mongo cluster ⇒ N
process `mongo-mcp`, mỗi process nhận đúng 1 URI qua env). Registry spawn + giữ 1 MCP client cho
mỗi doc `enabled` → thêm cụm không đụng code.

> Registry chịu trách nhiệm vòng đời N child process: spawn lúc boot, health-check, restart khi
> chết. `// ponytail: restart đơn giản (exponential backoff); orchestrator không chết theo child`

**Kind template (constant)** — khai 1 lần "cách khởi chạy infra MCP đó" + "biến env mang connection
string", để seed khỏi lặp:

```js
// constant/defaults.constant.js
export const KIND_TEMPLATES = {
    mongo: { command: 'mongo-mcp', connEnv: 'MONGO_URI' },
    rabbit: { command: 'rabbit-mcp', connEnv: 'RABBITMQ_URL' },
    redis: { command: 'redis-mcp', connEnv: 'REDIS_URL' },
    // thêm kind mới = thêm 1 dòng
};
```

**Env seed = danh sách per kind** (mở rộng vô hạn, không đánh số cứng):

```
MONGO_TARGETS=[{"cluster":"shard1","conn":"mongodb://..."},{"cluster":"shard2","conn":"..."}]
RABBIT_TARGETS=[{"cluster":"prod","conn":"amqp://..."},{"cluster":"staging","conn":"..."}]
REDIS_TARGETS=[{"cluster":"cache","conn":"redis://..."},{"cluster":"queue","conn":"..."}]
```

zod parse: `z.string().transform(JSON.parse).pipe(z.array(z.object({ cluster, conn, capability? })))`.
Thêm instance = thêm phần tử mảng, schema không đổi. **Chốt: JSON-per-kind** (không dùng prefix-scan).

**Seed** (`seed.js`): mỗi kind × mỗi phần tử → dựng 1 `McpTarget` từ template:

```
{ name: `${kind}-${cluster}`, kind, cluster,
  command: tpl.command,
  env: [{ name: tpl.connEnv, secretKey: `${kind}_${cluster}` }],   // trỏ secret, không plain
  capability: item.capability ?? 'read' }
```

Connection string (chứa credential) đẩy vào **secret store** của `@mida/claude-config` (đã có
`encrypt/decrypt`), doc chỉ giữ `secretKey`.

HTTP downstream (P2): thay `command` bằng `url` per instance, cùng cấu trúc list.

---

## 6. Data model (chỉ 1)

**`models/mcp-target.model.js`** — export thẳng model (giống `mcp-server.model.js` của claude-config):

```js
name; // unique, "rabbit-prod"
kind; // enum: rabbit | redis | mongo | http | other
cluster; // "prod" | "shard1" | ...
enabled; // default true
transport; // stdio | http, default stdio
command / args; // stdio (args hỗ trợ ${secret:NAME})
url; // http
env; // [{ name, value, secretKey }]
capability; // read | write | admin, default 'read'   ← guard floor (mục 4)
order;
// timestamps, versionKey:false
```

Secret của downstream tham chiếu `secretKey`, resolve qua secret store của `@mida/claude-config`
(đã có `encrypt/decrypt` + thay `${secret:NAME}`). Không lưu plain trong target doc.

---

## 7. Config facade — `orchestratorService`

Gom nhóm theo tính năng (như `configService`):

```js
export const orchestratorService = {
    connect,                                        // mongo + mở registry
    registry: { list, connect, catalog, callTool, refresh },
    guard:    { get, set, check },                   // check(fullToolName) → allow|deny
    router:   { resolve },                           // resolve(kind, hint) → target
    target:   { list, upsert, delete },              // CRUD downstream (console)
};
```

Không có nhóm `knowledge` — orchestrator không đụng tới nó.

---

## 8. Cấu trúc thư mục (theo convention repo)

```
packages/orchestrator/
├── package.json                @mida/orchestrator
├── plan.md · .env.example
├── scripts/gen-token.js
└── src/
    ├── index.js                bootstrap: mongo → registry → MCP server (http|stdio)
    ├── server.js               createMcpServer(): registerAllTools
    ├── config.js               orchestratorService (facade)
    ├── seed.js                 seed target mặc định, capability=read
    ├── config/
    │   ├── env.config.js        zod (MONGO_URI, MCP_TRANSPORT, PORT, JWT_SECRET, REDIS_URL?)
    │   ├── mongo.config.js      connect/watch/getConnection/isReady
    │   └── redis.config.js      cache catalog/route (optional)
    ├── constant/
    │   ├── defaults.constant.js  target mặc định, NAMESPACE_SEP
    │   └── prompt.constant.js    system prompt orchestrator
    ├── helper/
    │   ├── mcp-client.helper.js  connect downstream (stdio/http), listTools, callTool
    │   ├── namespace.helper.js   toLocal / parse — giữ động từ cuối
    │   ├── guard.helper.js       guard: { get, set, check } (dùng READ_ONLY_REGEX)
    │   ├── format.helper.js      textContent/errorContent/redact
    │   └── tool.helper.js        wrap(name, fn)
    ├── registry/registry.js
    ├── router/router.js
    ├── middleware/auth.middleware.js   JWT
    └── tools/
        ├── index.js             registerAllTools
        ├── ping.tool.js
        ├── registry.tool.js     targets_list, catalog_list  (read)
        └── proxy.tool.js        đăng ký động các aggregated tool (plugin all)
```

---

## 9. Tool surface

| Tool                              | Loại | Mô tả                                             |
| --------------------------------- | ---- | ------------------------------------------------- |
| `ping`                            | read | health                                            |
| `targets_list`                    | read | downstream + kind/cluster/capability/status       |
| `catalog_list`                    | read | mọi aggregated tool, gom theo target              |
| `<kind>_<cluster>__<tool>` (động) | mix  | proxy 1-1 tool downstream, giữ nguyên inputSchema |

Đăng ký aggregated tool **động** lúc boot: catalog → mỗi (target, tool) →
`server.registerTool(localName, { inputSchema: <downstream schema> }, wrap(handler))`.
Handler: `guard.check` → `registry.callTool` → `format`. **Không** capture, **không** ghi state.

---

## 10. Luồng một call

```
agent gọi mcp__orchestrator__rabbit_prod__queue_purge {queue:"dlq"}
  ├─ Agent SDK canUseTool: .pop()="queue_purge" → không read-only → HỎI (còn trong disallowedTools)
  ├─ guard.check: rabbit-prod.capability phải = admin, không thì DENY
  ├─ registry.callTool(rabbit-prod, "queue_purge", args) → rabbit-mcp
  └─ trả format(kết quả)         ← hết, không lưu gì
```

---

## 11. Env & bảo mật

`.env` (zod):

| Biến                                                 | Vai trò                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `MONGO_URI`                                          | DB **registry của orchestrator** (lưu `McpTarget`), 1 chuỗi |
| `MONGO_TARGETS` / `RABBIT_TARGETS` / `REDIS_TARGETS` | **danh sách connection downstream** để seed (mục 5)         |
| `MCP_TRANSPORT` / `PORT` / `JWT_SECRET`              | server MCP                                                  |
| `REDIS_URL?`                                         | cache catalog/route (optional)                              |

Lưu ý phân biệt: `MONGO_URI` là store của chính orchestrator; các `*_TARGETS` mới là "nhiều
connection string" của hạ tầng cần điều phối. Kế thừa: JWT bearer (`auth.middleware.js`), redact
secret, guard mặc định `read`, nhóm delete/admin nằm sẵn trong `disallowedTools` phía agent.

---

## 12. Phasing

| Phase | Nội dung                                                                                            | Trạng thái                                                                         |
| ----- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P0    | registry (stdio) + aggregated proxy + guard read/write/admin + `targets_list`/`catalog_list` + JWT  | ✅ xong                                                                            |
| P1    | child resilience (onclose → reconnect backoff, retry-on-dead-client) + live refresh (change stream) | ✅ xong                                                                            |
| P2    | downstream HTTP transport (`transport:'http'` + `url`)                                              | ✅ cơ bản                                                                          |
| —     | router rule-engine + Redis cache                                                                    | ⏸ hoãn (YAGNI: tool per-cluster đã địa chỉ hoá được, chưa có luật định tuyến thật) |

---

## 13. Cần xác nhận

1. **Infra MCP (rabbit/redis/mongo)** — dùng MCP npm có sẵn hay tự viết? Nếu tự viết: package riêng
   trong monorepo hay repo khác? (quyết registry transport + seed)
2. **Router** — có cần chọn cụm tự động (theo domain/env) ngay P0, hay chọn tường minh là đủ?
3. **Guard ↔ disallowedTools** — muốn guard tự bơm danh sách mutate/admin vào `disallowedTools` của
   agent (một nguồn) không, hay khai báo 2 nơi?

> ✅ Đã chốt: mỗi connection string = 1 process infra MCP riêng · env `*_TARGETS` dạng JSON-per-kind.
