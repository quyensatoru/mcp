# @mida/orchestrator

MCP **orchestration gateway** (ESM + Express + `@modelcontextprotocol/sdk`) — một MCP duy nhất
đứng trước agent, điều phối nhiều **cụm MCP nhỏ** ở dưới (rabbit, mongo, redis, ...). Nó vừa là
**MCP server** (với `@mida/agent`) vừa là **MCP client** (với các MCP hạ tầng).

Lớp tri thức (pipeline cycle, playbook, architecture/object knowledge) **KHÔNG** nằm ở đây — tách
sang package riêng `@mida/knowledge` (xem `packages/knowledge/plan.md`). Orchestrator chỉ **ghi
vào** và **truy hồi từ** knowledge.

---

## 1. Mục tiêu & phạm vi

| Có làm                                                               | Không làm (để package khác)                          |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| Đăng ký / kết nối / discovery các MCP hạ tầng (đa cụm)              | Lưu trữ tri thức, playbook → `@mida/knowledge`       |
| Aggregate + namespace tool của downstream lên cho agent            | Quyết định hỏi-phép người dùng → Agent SDK (đã có)   |
| Guard "trần năng lực" (read/write/admin) theo config                | Kết nối Mattermost / stream UI → `@mida/agent`       |
| Router chọn cụm khi có nhiều instance cùng loại                     | Đánh index codebase → CodeGraph                      |
| Capture mỗi cycle (chuỗi tool call) → đẩy sang `@mida/knowledge`    |                                                      |

**Nguyên tắc:** orchestrator là **cổng + điều phối + guard**, mỏng nhất có thể. Mọi thứ "nhớ lâu"
đi sang knowledge; mọi thứ "hỏi phép" đã có ở Agent SDK.

---

## 2. Vị trí trong monorepo

```
@mida/agent ──(mcpServers config)──▶ @mida/orchestrator ──(MCP client)──▶ rabbit-mcp (prod|staging)
     │                                       │                          ├─▶ mongo-mcp  (shard1|shard2)
     │  buildAgentOptions()                  │  guard + router          └─▶ redis-mcp  (cache|queue)
     ▼                                       ▼
@mida/claude-config                    @mida/knowledge   ◀── cũng được @mida/agent & skills dùng
 (đăng ký orchestrator như 1 mcpServer) (record/recall cycle + playbook)
```

- Agent **không** kết nối trực tiếp các MCP hạ tầng. Chỉ nói chuyện với orchestrator → một điểm
  kiểm soát, một điểm capture.
- Orchestrator được khai báo trong `claude-config` như một `mcpServer` (giống `mida-rca` hiện tại,
  xem `packages/claude-config/src/constant/defaults.constant.js`).

---

## 3. Kiến trúc: Gateway/Aggregator

Hai vai:

1. **Server (với agent):** `createMcpServer()` (giống `packages/mcp/src/server.js`) đăng ký:
   - **Aggregated tools** — proxy toàn bộ tool của downstream (đã namespace). Đây là ý "plugin all
     tool" của yêu cầu.
   - **Meta tools** — `targets_list`, `catalog_list`, `workflow_recall`, `workflow_run`, `ping`.
2. **Client (với downstream):** một **registry** giữ pool MCP client (`@modelcontextprotocol/sdk`
   client, stdio/http), gọi `tools/list` để lấy catalog, `tools/call` để chuyển tiếp.

Cả hai transport như `mida-rca`: HTTP (JWT, stateless) mặc định, `stdio` cho local.

> **Lazy note:** P0 có thể chạy downstream **stdio child process** (đơn giản, không cần deploy
> riêng) rồi mới nâng HTTP khi cần scale. `// ponytail: stdio-first, HTTP khi cần multi-host`.

---

## 4. Quyết định #1 — Guard đặt ở đâu? (đã nghiên cứu)

**Kết luận: nhận định của bạn đúng — và repo NÀY đã áp dụng đúng mô hình 2 lớp đó.** Permission
chia làm 2 tầng riêng biệt:

### Lớp 1 — MCP = trần năng lực (capability floor), set bằng ENV/config

Đây là "config env cho mcp lên set quyền read". Bằng chứng đã có ở `mida-rca`:

- `packages/mcp/src/config/db.config.js` — kết nối Mongo bằng **user read-only**.
- README `mida-mcp`: whitelist collection theo DB, chặn `$out/$merge/$function/$where`, redact
  `access_token`/secret, App API chỉ GET + whitelist path.
  → MCP **về mặt vật lý không ghi được**, bất kể agent muốn gì.

Với orchestrator, mở rộng khái niệm này thành `capability` **per-target** (vì orchestrator nắm
client hạ tầng **có thể ghi**: rabbit publish, redis set, mongo write — thứ `mida-rca` read-only
chưa từng có):

- Mỗi downstream target có `capability ∈ {read, write, admin}` (mặc định `read`).
- `guard.helper.js` phân loại tool (read vs mutate) và **chặn ở biên MCP** nếu target chưa đủ quyền.

### Lớp 2 — Agent SDK = quyết định cấp phép + human-in-the-loop

Đây là "permission sẽ agent sdk quản lý". Bằng chứng đã có:

- `packages/claude-config/src/config.js` → `buildAgentOptions()`: `permissionMode`,
  `disallowedTools` (vd `mcp__twenty-crm__update_*`, `..._delete_*`), `allowedTools`, và PreToolUse
  **deny hook** (`buildHooks` → `buildDenyHook`).
- `packages/agent/src/claude/mattermost.claude.js` → `buildCanUseTool()`: auto-allow tool read-only
  theo `READ_ONLY_REGEX`, còn tool update/delete thì **hỏi yes/no** (timeout → deny).

### Khuyến nghị

| Nhóm hành động            | Agent SDK (lớp 2)                          | Guard orchestrator (lớp 1)       |
| ------------------------- | ----------------------------------------- | -------------------------------- |
| read (get/list/search)    | auto-allow (`READ_ONLY_REGEX`)            | cho phép                         |
| write (publish/set/insert)| `canUseTool` hỏi phép                      | yêu cầu `capability ≥ write`     |
| delete/purge/drop/admin   | nằm sẵn trong `disallowedTools` + hỏi phép | yêu cầu `capability = admin`     |

- **GIỮ quyết định cấp phép ở Agent SDK** — một chỗ, có human-in-the-loop, đã build sẵn, đồng nhất
  cho mọi MCP. Orchestrator **không** dựng cơ chế hỏi-phép riêng (tránh 2 nguồn sự thật).
- **Guard trần-năng-lực vẫn cần** ở orchestrator: đây là defense-in-depth. Một lệnh huỷ (queue
  purge, key flush, collection drop) không nên chỉ dựa vào một cổng. Guard là "cầu dao cứng" bật
  bằng config, độc lập với việc agent có bị lừa/lỗi hay không.

### Điều kiện kỹ thuật để mapping chạy đúng — Namespacing convention

Agent thấy tên đầy đủ `mcp__<server>__<local>`. `buildCanUseTool` lấy `toolName.split('__').pop()`
để test `READ_ONLY_REGEX`. Vậy tên local **phải giữ động từ ở segment cuối** (sau `__`):

```
downstream target "rabbit-prod", tool "queue_publish"
  → local name:  rabbit_prod__queue_publish        (─ đổi thành _; __ ngăn giữa target và tool)
  → agent thấy:  mcp__orchestrator__rabbit_prod__queue_publish
  → .split('__').pop() = "queue_publish"  → READ_ONLY_REGEX không match → hỏi phép ✅
  → disallowedTools:  "mcp__orchestrator__*__*purge*"  vẫn match ✅
```

`guard.helper.js` sẽ dùng chung `READ_ONLY_REGEX` (`packages/claude-config/src/constant/defaults.constant.js`)
để phân loại → **một định nghĩa read/write duy nhất** cho cả 2 lớp.

---

## 5. Registry đa cụm + Router

Yêu cầu: "nhiều cụm mcp rabbit, mongo, redis". Một downstream định danh bằng `(kind, cluster)`.

- **Registry** (`registry/registry.js`): đọc `McpTarget` từ Mongo → với mỗi target `enabled`, mở MCP
  client, `tools/list`, cache catalog. Giữ map `name → { client, tools, capability }`.
- **Router** (`router/router.js`): khi một tool cần "chọn cụm" (vd nhiều cụm rabbit), resolve target
  theo hint. Mô phỏng đúng `resolveProxy(domain) → 1|2` của `mida-rca`
  (`packages/mcp/src/services/proxy.service.js`) — hàm DUY NHẤT định tuyến.
  - P0: chọn tường minh qua tham số (`cluster: "prod"`) hoặc target mặc định mỗi kind.
  - P1: rule-based (theo domain/env) + cache Redis. `// ponytail: explicit-first, resolver sau`.

---

## 6. Data models

Chỉ **1 model** thuộc orchestrator (registry). Model cycle/playbook nằm ở `@mida/knowledge`.

**`models/mcp-target.model.js`** — export thẳng model (giống `mcp-server.model.js`):

```js
name        // unique, vd "rabbit-prod"
kind        // enum: rabbit | mongo | redis | http | other
cluster     // "prod" | "shard1" | ...
enabled     // bool, default true
transport   // enum: stdio | http, default stdio
command     // stdio
args        // [String], hỗ trợ ${secret:NAME} (giống mcp-server.model)
url         // http
env         // [{ name, value, secretKey }]
capability  // enum: read | write | admin, default 'read'   ← trần năng lực (Q1)
order       // number
// timestamps, versionKey:false
```

**`models/guard-policy.model.js`** — *(P1, optional)* singleton chỉnh từ console: regex phân loại
mutate/admin override + danh sách pattern chặn cứng. P0 dùng constant + `READ_ONLY_REGEX`, **chưa
cần model này**. `// ponytail: skip tới khi cần chỉnh guard runtime`.

---

## 7. Config facade — `orchestratorService`

Gom theo tính năng/model như `configService` (`packages/claude-config/src/config.js`) và
`loopEngineerService`:

```js
export const orchestratorService = {
    connect,                              // mongo + mở registry
    registry: { list, connect, catalog, callTool, refresh },
    guard:    { get, set, check },        // check(fullToolName) → allow|deny (trần năng lực)
    router:   { resolve },                // resolve(kind, hint) → target
    target:   { list, upsert, delete },   // CRUD downstream (console dùng)
};
```

Knowledge được gọi qua `@mida/knowledge` (import trực tiếp), không nhét vào facade này.

---

## 8. Cấu trúc thư mục (theo convention repo)

```
packages/orchestrator/
├── package.json                 @mida/orchestrator
├── plan.md
├── .env.example
├── scripts/
│   └── gen-token.js             (copy từ mida-mcp)
└── src/
    ├── index.js                 bootstrap: mongo → registry → MCP server (http|stdio)
    ├── server.js                createMcpServer(): registerAllTools/Resources
    ├── config.js                orchestratorService (facade gom nhóm)
    ├── seed.js                  seed target mặc định + capability=read
    ├── config/
    │   ├── env.config.js        zod (MONGO_URI, MCP_TRANSPORT, JWT_SECRET, PORT, REDIS_URL)
    │   ├── mongo.config.js      connect/watch/getConnection/isReady (copy claude-config)
    │   └── redis.config.js      cache catalog/route (optional, copy mida-mcp)
    ├── constant/
    │   ├── defaults.constant.js  target mặc định, NAMESPACE_SEP, MUTATE_REGEX
    │   └── prompt.constant.js    system prompt orchestrator
    ├── helper/
    │   ├── mcp-client.helper.js  connect downstream (stdio/http), listTools, callTool
    │   ├── namespace.helper.js   toLocal(target,tool) / parse(local) — giữ động từ cuối
    │   ├── guard.helper.js       guard: { get, set, check } — dùng READ_ONLY_REGEX
    │   ├── format.helper.js      textContent/errorContent/redact (copy mida-mcp)
    │   └── tool.helper.js        wrap(name, fn) (copy mida-mcp)
    ├── registry/
    │   └── registry.js           pool client + catalog tổng hợp
    ├── router/
    │   └── router.js             resolve(kind, hint) → target
    ├── middleware/
    │   └── auth.middleware.js    JWT (copy mida-mcp)
    ├── tools/
    │   ├── index.js              registerAllTools
    │   ├── ping.tool.js
    │   ├── registry.tool.js      targets_list, catalog_list  (read)
    │   ├── proxy.tool.js         đăng ký động các aggregated tool (plugin all)
    │   └── workflow.tool.js      workflow_recall / workflow_run  (cầu sang knowledge)
    └── resources/
        └── index.js              (optional) catalog:// resource
```

---

## 9. Tool surface

| Tool                                    | Loại   | Mô tả                                                     |
| --------------------------------------- | ------ | -------------------------------------------------------- |
| `ping`                                  | read   | health                                                   |
| `targets_list`                          | read   | liệt kê downstream + kind/cluster/capability/status      |
| `catalog_list`                          | read   | liệt kê mọi aggregated tool, gom theo target             |
| `<kind>_<cluster>__<tool>` (động)       | mix    | proxy 1-1 tool downstream, giữ nguyên inputSchema        |
| `workflow_recall`                       | read   | task → chuỗi bước đã chạy thành công (từ `@mida/knowledge`)|
| `workflow_run`                          | mutate | chạy 1 playbook (fan-out; mỗi bước vẫn qua guard + SDK)   |

Aggregated tool đăng ký **động** lúc boot: registry catalog → với mỗi (target, tool) gọi
`server.registerTool(localName, { inputSchema: <schema downstream> }, wrap(...))`. Handler: `guard.check`
→ `registry.callTool` → `knowledge.runs.step()` (capture) → trả `format`.

---

## 10. Luồng một cycle (end-to-end)

```
1. agent gọi workflow_recall("purge dead-letter queue cụm prod")
     └─ orchestrator → knowledge.recall.forTask() → trả chuỗi bước đã kiểm chứng (nếu có)
2. agent theo gợi ý, gọi mcp__orchestrator__rabbit_prod__queue_purge {queue:"dlq"}
     ├─ Agent SDK canUseTool: tên .pop()="queue_purge" → không read-only → HỎI yes/no
     │    (queue_purge còn nằm trong disallowedTools mặc định → chặn tới khi cho phép rõ ràng)
     ├─ guard.check: rabbit-prod.capability? phải = admin, không thì DENY (trần năng lực)
     ├─ registry.callTool(rabbit-prod, "queue_purge", args) → downstream MCP
     └─ knowledge.runs.step(runKey, {target, tool, status, ms})   ← capture
3. hết phiên → knowledge.runs.finish(runKey) → (P2) distill thành playbook nếu thành công
```

**Correlation `runKey`:** HTTP stateless (như `mida-rca`, `sessionIdGenerator: undefined`) nên
không có session liên tục. P0: agent truyền `runKey` (thread id nó đã có) như tham số ẩn ở meta
tool, hoặc lấy từ `sub` của JWT. Ghi rời từng step rồi stitch theo `runKey`.
`// ponytail: runKey qua arg; nâng stateful nếu cần trace chặt`. *(Cần xác nhận — xem mục 13.)*

---

## 11. Env & bảo mật

`.env` (zod, copy khung `mida-mcp`): `MONGO_URI`, `MCP_TRANSPORT`, `PORT`, `JWT_SECRET`,
`REDIS_URL?`. Secret của downstream **không** để trong target doc dạng plain — tham chiếu
`secretKey` và resolve qua `@mida/claude-config` secret store (đã có `encrypt/decrypt`), giống cách
`buildMcpServers()` thay `${secret:NAME}`.

Bảo mật kế thừa `mida-rca`: JWT bearer (`auth.middleware.js`), redact secret khỏi mọi output, guard
mặc định `read`, delete/admin mặc định trong `disallowedTools`.

---

## 12. Phasing

| Phase | Nội dung                                                                                     |
| ----- | ------------------------------------------------------------------------------------------- |
| P0    | registry (stdio) + aggregated proxy tool + guard read/write + `targets_list`/`catalog_list` + JWT + capture cơ bản sang `@mida/knowledge` |
| P1    | router đa cụm (rule + Redis cache) + `guard-policy` model chỉnh từ console + `workflow_recall` |
| P2    | `workflow_run` (replay playbook) + auto-distill cycle→playbook (bên knowledge)               |

**Ponytail deferrals:** downstream HTTP (P0 dùng stdio); `guard-policy` model (P0 dùng constant);
router resolver (P0 chọn tường minh); vector match (knowledge dùng keyword trước).

---

## 13. Cần xác nhận

1. **Downstream MCP rabbit/mongo/redis** — dùng MCP có sẵn (npm) hay tự viết? Nếu tự viết, chúng là
   package riêng trong monorepo hay repo khác? (ảnh hưởng registry transport & seed)
2. **Gateway vs Sidecar** — chốt mô hình **gateway** (agent chỉ nói với orchestrator, xác nhận ở
   mục 3)? Hay agent vẫn gọi thẳng vài MCP và orchestrator chỉ điều phối phần phức tạp?
3. **`runKey` correlation** — chấp nhận truyền qua arg (P0) hay cần orchestrator stateful để trace
   liền mạch một cycle?
4. **Guard vs disallowedTools** — có muốn guard tự đồng bộ danh sách mutate/admin vào
   `disallowedTools` của agent (một nguồn) không, hay giữ 2 nơi khai báo?
