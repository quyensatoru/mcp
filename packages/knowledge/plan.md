# @mida/knowledge

Lớp **tri thức dùng chung** của MIDA — package độc lập, không gắn chặt vào orchestrator. Lưu và
truy hồi: **playbook** (workflow đã kiểm chứng), **architecture/object knowledge** (kiến trúc, quan
hệ model/domain), và **codebase knowledge** (trỏ tới CodeGraph). Được dùng bởi nhiều nơi:
`@mida/orchestrator`, `@mida/agent`, và **inject thẳng vào skill**.

> Tách khỏi orchestrator theo đúng yêu cầu: tri thức là tài sản tái dùng nhiều (object/architecture
> knowledge cho app), cần cả codebase — không nên chôn trong một MCP điều phối.

---

## 1. Mục tiêu

- **Chống "agent bịa/mò mỗi lần":** thay vì mỗi phiên agent tự đoán chuỗi tool, nó **recall** chuỗi
  đã chạy thành công trước đó, hoặc một playbook đã được chưng cất.
- **Nguồn tri thức kiến trúc cho app:** object/model/domain, luồng dữ liệu, quyết định thiết kế —
  curate một lần, dùng nhiều nơi.
- **Codebase-aware:** liên kết tri thức với code thật qua **CodeGraph** (không tự đánh index lại).
- **Inject vào skill:** skill (repo `mida-skills`) kéo tri thức liên quan làm context trước khi làm.

Không làm: điều phối/gọi MCP hạ tầng (→ `@mida/orchestrator`); hỏi-phép (→ Agent SDK).

---

## 2. Các loại tri thức (knowledge kinds)

| Kind        | Nguồn                                   | Ai đọc                          | Model              |
| ----------- | --------------------------------------- | ------------------------------- | ------------------ |
| `playbook`  | chưng cất từ pipeline cycle / curate    | orchestrator, agent, skill      | `playbook`         |
| `run`       | orchestrator ghi mỗi cycle (raw log)    | (nội bộ, để distill)            | `pipeline-run`     |
| `arch`      | curate (console) + tài liệu             | agent, skill                    | `arch-note`        |
| `object`    | curate + suy ra từ model/domain         | agent, skill                    | `object-note`      |
| `codemap`   | **CodeGraph** (adapter, không lưu code) | agent, skill                    | `code-ref` (con trỏ)|

`run` là nguyên liệu thô; `playbook` là thành phẩm. `arch`/`object` là tri thức người-curate.
`codemap` chỉ là **con trỏ** (symbol → file/mô tả) đồng bộ từ CodeGraph, không nhân bản source.

---

## 3. Nguồn dữ liệu & quan hệ

```
@mida/orchestrator ──record cycle──▶ pipeline-run ──distill (P2)──▶ playbook
@mida/agent        ──recall/inject──▶ knowledgeService ◀──inject── mida-skills (skill)
console            ──curate arch/object──▶ arch-note / object-note
CodeGraph (per-repo .codegraph) ◀──adapter──▶ codemap  (mida-api, mida-recorder, ...)
```

- knowledge **không** phụ thuộc orchestrator (chiều phụ thuộc: orchestrator → knowledge).
- CodeGraph: harness root không có `.codegraph`, nhưng các repo dịch vụ (mida-api, mida-recorder…)
  có. Adapter gọi CodeGraph theo `projectPath` từng repo. `// ponytail: đừng reinvent code index`.

---

## 4. Data models (export thẳng model)

**`pipeline-run.model.js`** — nhật ký một cycle (tương tự `LoopRun` của loop-engineer):

```js
runKey    // index — thread/session key
source    // 'orchestrator' | 'agent' | 'chat'
task      // intent text của người dùng
tags      // [String] — để recall
steps     // [{ index, target, tool, argsDigest, status, ms, error }]  (subdoc, _id:false)
status    // running | done | error
startedAt / endedAt
// timestamps, versionKey:false ; index { runKey:1, startedAt:-1 }
```

**`playbook.model.js`** — workflow tái dùng đã chưng cất:

```js
name        // unique
slug        // unique
tags        // [String] — signature để match task
description
steps       // [{ target, tool, note }] — công thức có thứ tự
stats       // { uses, successes, lastUsedAt }
source      // 'manual' | 'distilled'
enabled     // bool
// timestamps, versionKey:false
```

**`arch-note.model.js`** / **`object-note.model.js`** — tri thức curate:

```js
key         // unique, vd "recorder.session-flow" | "model.Shop"
title
tags        // [String]
body        // markdown (maxlength hợp lý)
refs        // [{ repo, symbol }]  → nối sang codemap/CodeGraph
enabled
// timestamps
```

**`code-ref.model.js`** — con trỏ codebase *(P2, optional)*: `{ repo, symbol, file, summary, tags }`,
đồng bộ từ CodeGraph. P0/P1 truy CodeGraph **trực tiếp** khi cần, chưa cần cache model này.
`// ponytail: chỉ cache khi truy CodeGraph live quá chậm`.

---

## 5. Config facade — `knowledgeService`

Gom nhóm theo model/tính năng (như `configService` / `loopEngineerService`):

```js
export const knowledgeService = {
    connect,
    runs:     { record, step, finish, list, get },      // orchestrator ghi cycle
    playbook: { list, get, save, promote },             // thành phẩm
    arch:     { list, get, upsert, delete },            // curate
    object:   { list, get, upsert, delete },            // curate
    codemap:  { search },                                // adapter CodeGraph
    recall:   { forTask, forSkill },                     // truy hồi hợp nhất mọi kind
    inject:   { forSkill },                              // render context nhét vào skill
};
```

---

## 6. Recall & Match (giữ lazy)

`recall.forTask(task)` trả về gói tri thức liên quan: playbook khớp nhất + arch/object liên quan +
(optional) codemap refs.

- **P0 matching:** keyword + tag score bằng **MiniSearch** — dep đã kiểm chứng trong `mida-rca`
  (`docs.service.js` + `build-docs-index.js`). Không vector DB, không embedding. YAGNI.
- **Upgrade path:** khi keyword hụt, thêm embedding + kNN. `// ponytail: keyword-first, embedding khi recall trượt nhiều`.

---

## 7. Inject vào skill (yêu cầu cốt lõi)

Hai kênh, khuyến nghị làm **cả hai** vì consumer khác nhau:

1. **Programmatic (trong monorepo):** `@mida/agent` / package nội bộ `import { knowledgeService }` →
   `inject.forSkill(name)` trả markdown context để prepend.
2. **Read surface (skill ngoài repo — `mida-skills`):** một endpoint đọc (HTTP GET hoặc MCP read
   tool `knowledge_recall`) để skill kéo context. Read-only → auto qua `READ_ONLY_REGEX`, không đụng
   guard/permission.

`inject.forSkill` render gọn: playbook (các bước) + arch/object liên quan + refs code, cắt theo
ngân sách token. Template ở `constant/prompt.constant.js`.

*(Cần xác nhận: skill tiêu thụ qua HTTP hay MCP tool — xem mục 11.)*

---

## 8. Cấu trúc thư mục (theo convention repo)

```
packages/knowledge/
├── package.json                @mida/knowledge  (mongoose, minisearch, @mida/logger, zod)
├── plan.md
├── .env.example
├── scripts/
│   └── seed.js
└── src/
    ├── index.js                export knowledgeService + models skill/agent cần
    ├── config.js               knowledgeService (facade gom nhóm)
    ├── seed.js                 seed arch/object mẫu + playbook mẫu
    ├── config/
    │   ├── env.config.js       zod (MONGO_URI, ...)
    │   └── mongo.config.js     connect/watch/getConnection/isReady (copy claude-config)
    ├── constant/
    │   ├── defaults.constant.js  KINDS, MATCH_WEIGHTS, inject budget
    │   └── prompt.constant.js    distill prompt + inject template
    ├── helper/
    │   ├── match.helper.js       score/rank theo task/tags (MiniSearch)
    │   ├── distill.helper.js     run[] → playbook (P2)
    │   ├── inject.helper.js      render markdown context
    │   └── codegraph.helper.js   adapter CodeGraph (theo projectPath repo)
    ├── models/
    │   ├── index.js
    │   ├── pipeline-run.model.js
    │   ├── playbook.model.js
    │   ├── arch-note.model.js
    │   ├── object-note.model.js
    │   └── code-ref.model.js     (P2)
    └── services/
        ├── recall.service.js     truy hồi hợp nhất
        └── inject.service.js     build context cho skill/agent
```

---

## 9. Distillation cycle → playbook (P2)

Khi có N run **thành công** cùng `tags`, chưng cất thành 1 playbook:

- **P1:** thủ công — console review run tốt → `playbook.save` (source `manual`).
- **P2:** tự động — `distill.helper` gom N run tương tự, LLM tóm tắt chuỗi bước ổn định → playbook
  (source `distilled`), cập nhật `stats`. Chỉ promote khi tỉ lệ thành công vượt ngưỡng.

`// ponytail: manual promote trước; auto-distill khi đã đủ dữ liệu run`.

---

## 10. Phasing

| Phase | Nội dung                                                                            |
| ----- | ---------------------------------------------------------------------------------- |
| P0    | models + `knowledgeService` + `runs.*` (orchestrator ghi) + `recall.forTask` (MiniSearch) |
| P1    | `arch`/`object` curate (console) + `inject.forSkill` + read surface cho skill      |
| P2    | auto-distill run→playbook + `codemap` qua CodeGraph + embedding match (nếu cần)     |

---

## 11. Cần xác nhận

1. **Consumer skill** — skill trong `mida-skills` kéo tri thức qua **HTTP endpoint** hay **MCP read
   tool**? (quyết định có cần dựng server riêng cho knowledge hay chỉ là library + tool trong agent)
2. **CodeGraph scope** — `codemap` trỏ tới những repo nào (mida-api, mida-recorder, mida-hm…)? Có
   cần cache `code-ref` hay truy live đủ?
3. **Deploy** — knowledge là **library thuần** (chỉ import) hay có **process riêng** (HTTP) để skill
   ngoài repo gọi? Khuyến nghị: library + tool trong agent trước, tách HTTP khi có consumer ngoài.
4. **Chung Mongo với claude-config** hay DB riêng? (ảnh hưởng `env.config.js` + seed)
