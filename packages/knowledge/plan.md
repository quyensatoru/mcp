# @mida/knowledge

Một **MCP server độc lập** vừa **lưu trữ tri thức** vừa expose tool cho Agent SDK / Claude Code lấy
ra và ghi vào: `get_knowledge`, `save_knowledge`. Đây là kho tri thức dùng chung của app (playbook,
debug workflow, pipeline summary, kiến trúc/object, con trỏ codebase).

**Ranh giới rõ:** package này chỉ là **kho + MCP get/save**. _Cách_ sinh tri thức — "dựa vào
codebase ⇒ workflow debug" và "pipeline tự summary" — nằm ở **`mida-skills`** (bạn cập nhật sau), nó
gọi `save_knowledge` để lưu. Knowledge **không** biết codebase, **không** chạy CodeGraph, **không**
tự distill. Nó chỉ lưu cái skill đưa vào và trả cái agent hỏi.

---

## 1. Mục tiêu

- **Chống "agent bịa/mò mỗi lần":** agent `get_knowledge(task)` để lấy playbook/debug-workflow đã
  lưu, thay vì tự đoán lại.
- **Kho tri thức tái dùng:** một chỗ lưu, nhiều nơi đọc (agent, skill).
- **API tối giản, ổn định:** get/save là hợp đồng chính; nội dung/loại do skill quyết định.

Không làm: điều phối infra MCP (→ `@mida/orchestrator`); đọc codebase / CodeGraph (→ `mida-skills`);
hỏi-phép (→ Agent SDK).

---

## 2. Vị trí trong monorepo

```
mida-skills (skill: codebase → debug workflow / pipeline summary)
      │ save_knowledge (write)
      ▼
@mida/agent ──get_knowledge (read) / save_knowledge (write)──▶ @mida/knowledge (MCP riêng)
```

Khai báo trong `claude-config` như một mcpServer độc lập, song song với `orchestrator`.

---

## 3. Data model — gộp một, phân biệt bằng `type` (lazy)

Một collection `knowledge`, thay vì tách 4–5 model — vì loại/nội dung do skill định đoạt và còn thay
đổi. Tách sau nếu một loại phình to. `// ponytail: single typed collection; split khi cần`.

**`models/knowledge.model.js`** — export thẳng model:

```js
type; // enum: pipeline-summary | debug-workflow | rootcause-catalog | playbook | note
key; // optional, unique-sparse — để upsert (vd "pipeline-session-recording")
title;
tags; // [String] — signature để recall (feature-area, component, symptom...)
body; // markdown/text — nội dung tri thức (recall full-text đánh vào đây)
data; // Mixed — payload có cấu trúc: graph{nodes(type),edges} | causes | diagnosticFlow/rootCauseBranches/negativeEvidence
confidence; // 'verified' | 'likely' | 'hypothesis' — skill chỉ nên lưu 'verified'
refs; // [{ repo, file, line, symbol }] — con trỏ codebase, line để mở code nhanh
source; // 'skill' | 'agent' | 'manual'
stats; // { uses, lastUsedAt }
enabled; // default true
// timestamps, versionKey:false
// text index: { title, body, tags }   (recall bằng full-text)
```

**Không tách `architecture` riêng** — `pipeline-summary` gánh cả topology (node có `type`) lẫn runtime
flow (edge) trong một graph, tránh 2 nguồn mô tả cùng hệ thống rồi lệch nhau theo thời gian.

**Evidence / VerifiedFact KHÔNG lưu ở đây** — chúng là bước trung gian của skill (tool logs →
verified fact có file:line). Chỉ tri thức đã tổng quát hoá + `confidence:"verified"` mới `save_knowledge`.

**Payload cấu trúc top-level → `data`:** skill gọi `save_knowledge({type,key,graph:{...}})` /
`{components,connections}` / `{causes}`... field lạ được gom vào `data` (tool `.passthrough()` + `foldData`),
khỏi phải bọc tay `data:{...}`.

**Upsert = MERGE, không đè** (`helper/merge.helper.js`): cùng `key` thì bồi thêm —
scalar (title/body/confidence) lấy mới, mảng (tags/refs/`graph.nodes`/`graph.edges`/`causes`/branches) hợp

- khử trùng theo deep-equality, object lồng merge đệ quy; `stats.uses` giữ nguyên. Nhờ vậy topology
  `A→B→C` nhận `A→B→D→C` sẽ thành `A→B→C` + nhánh `B→D→C`.
  `// ponytail: union deep-equality — edge/cause đổi nhãn thành mục mới, chưa báo conflict; thêm khi cần.`

---

## 4. Tool surface (MCP)

| Tool             | Loại  | Mô tả                                                                 |
| ---------------- | ----- | --------------------------------------------------------------------- |
| `ping`           | read  | health                                                                |
| `get_knowledge`  | read  | truy hồi theo `query` (+ filter `type`/`tags`) → ranked; tăng `stats` |
| `list_knowledge` | read  | liệt kê theo `type`/`tags` (phân trang)                               |
| `save_knowledge` | write | upsert theo `key` hoặc tạo mới (skill/agent ghi vào)                  |

Read/write ánh xạ đúng lớp permission:

- `get_knowledge` / `list_knowledge` → `.pop()` chứa `get`/`list` → `READ_ONLY_REGEX` auto-allow.
- `save_knowledge` → không read-only → **Agent SDK hỏi phép** (như mọi tool ghi). Không cần guard
  riêng: knowledge chỉ ghi vào Mongo của chính nó, phạm vi hẹp.

---

## 5. Recall & Match (giữ lazy)

`get_knowledge`: full-text (Mongo `$text`) + boost theo `tags` khớp + lọc `type`. Đủ cho P0/P1.

- Không vector DB, không embedding ở P0. `// ponytail: full-text trước; embedding khi recall trượt`.
- Nếu cần ranking tốt hơn: thêm MiniSearch (dep đã có trong repo) hoặc embedding + kNN sau.

---

## 6. Cấu trúc thư mục (theo convention repo)

```
packages/knowledge/
├── package.json                @mida/knowledge  (mongoose, @mida/logger, zod)
├── plan.md · .env.example
├── scripts/{gen-token.js, seed.js}
└── src/
    ├── index.js                export knowledgeService (+ model nếu package khác import)
    ├── server.js               createMcpServer(): registerAllTools
    ├── config.js               knowledgeService (facade)
    ├── seed.js                 seed vài note mẫu
    ├── config/
    │   ├── env.config.js        zod (MONGO_URI, MCP_TRANSPORT, PORT, JWT_SECRET)
    │   └── mongo.config.js      connect/watch/getConnection/isReady
    ├── constant/
    │   └── defaults.constant.js  KINDS, recall weights, page size
    ├── helper/
    │   ├── match.helper.js       rank kết quả recall
    │   ├── format.helper.js      textContent/errorContent
    │   └── tool.helper.js        wrap(name, fn)
    ├── middleware/auth.middleware.js   JWT
    ├── models/
    │   ├── index.js
    │   └── knowledge.model.js
    └── tools/
        ├── index.js
        ├── ping.tool.js
        └── knowledge.tool.js    get_knowledge / list_knowledge / save_knowledge
```

## 7. Config facade — `knowledgeService`

```js
export const knowledgeService = {
    connect,
    entry: { get, list, save, remove }, // CRUD nội bộ (console/skill import trực tiếp)
    recall: { forQuery }, // full-text + tag rank — get_knowledge dùng
};
```

Tool `knowledge.tool.js` chỉ là lớp mỏng gọi facade này + `format`.

---

## 8. Phasing

| Phase | Nội dung                                                                                 | Trạng thái                                                              |
| ----- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| P0    | model `knowledge` + `knowledgeService` + MCP tool get/list/save + JWT + full-text recall | ✅ xong                                                                 |
| P1    | MCP resources `knowledge://index` + `knowledge://entry/{key}` (surface inject context)   | ✅ xong                                                                 |
| —     | MiniSearch/embedding ranking                                                             | ⏸ hoãn (YAGNI: `$text` + tag-rank đang đủ; nâng khi recall trượt nhiều) |
| —     | console xem/sửa entry · versioning                                                       | ⏸ hoãn (console = frontend riêng; versioning speculative)               |
| —     | auto-distill run→playbook · codemap CodeGraph                                            | ➡ thuộc `mida-skills` (đã chốt ranh giới)                               |

---

## 9. Cần xác nhận

1. **Chung Mongo với claude-config** hay DB riêng? (ảnh hưởng `env.config.js` + seed)
2. **`type` cố định hay tự do** — chốt enum ban đầu (playbook / debug-workflow / pipeline-summary /
   arch / object / note) hay để free-string cho skill tự đặt?
3. **Upsert key** — skill tự sinh `key` (idempotent) hay luôn tạo bản mới rồi để recall lọc?
