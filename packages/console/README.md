# @mida/console

Control-plane cho monorepo mida-rca: **single source of truth cho cấu hình động** (lưu trong MongoDB),
**REST API + WebSocket**, và **dashboard** React để chỉnh config, duyệt/sửa file trong session worktree
(kiểu VSCode), và chat trực tiếp với agent.

## Kiến trúc

Lớp config (configService, models, buildAgentOptions) và loop engine đã tách sang
`@mida/claude-config` và `@mida/loop-engineer` — console chỉ còn tiêu thụ hai package
đó, không sở hữu config nữa. `@mida/agent` (Mattermost) import thẳng hai package này,
không còn phụ thuộc vào `@mida/console`.

```
src/
  server/
    app.js                # Express: /api/config, /api/sessions, /api/files, /api/git + serve web/dist
    auth.js               # bearer token (CONSOLE_TOKEN)
    paths.js              # traversal-guard cho session worktree
    git.js                # git exec helper
    chat.service.js       # WS /ws/chat — chạy agent, stream event, duyệt tool inline
    ws/terminal.ws.js     # WS /ws/terminal — chạy lệnh trong worktree
  index.js                # boot: connect config + http server + WS upgrade routing
web/                      # Vite + React + Tailwind dashboard → build ra web/dist
```

## Chạy

```bash
cp .env.example .env                    # điền MONGO_URI (hoặc dùng chung packages/agent/.env)
pnpm --filter @mida/claude-config seed  # seed config từ env (in ra effective runtime)
pnpm --filter @mida/console build:web
node packages/console/src/index.js   # → http://localhost:4000

# Dev dashboard có HMR (cần server 4000 chạy song song):
pnpm --filter @mida/console dev:web  # vite :5173, proxy /api + /ws → :4000
```

## Env

| Biến                 | Mặc định | Mô tả                                                      |
| -------------------- | -------- | ---------------------------------------------------------- |
| `CONSOLE_PORT`       | 4000     | Cổng API + dashboard                                       |
| `CONSOLE_TOKEN`      | —        | Bearer token cho `/api/*` (trống = mở, chỉ dùng dev)       |
| `MONGO_URI`          | —        | Bắt buộc; fallback `packages/agent/.env`                   |
| `CONSOLE_MASTER_KEY` | —        | Passphrase mã hóa secret at-rest (set **trước** seed đầu)  |
| `CONFIG_TTL_MS`      | 30000    | TTL cache config (Mongo standalone không có change stream) |

> Mongo standalone không hỗ trợ change stream → dùng cache TTL. Bấm **↻ Reload** trên dashboard
> (hoặc `POST /api/config/reload`) để áp dụng ngay thay đổi config từ tiến trình khác.

## Test

```bash
pnpm --filter @mida/claude-config test   # node:test — crypto + defaults (không cần DB)
```
