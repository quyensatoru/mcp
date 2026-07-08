# mida-doc

MCP server quản lý và tra cứu tài liệu (docs) Mida — cung cấp tool `docs_search`
và resource `mida-doc://*` cho AI đọc/tìm nội dung help center Mida.

Package: [`packages/mida-doc`](packages/mida-doc).

## Tính năng

| Nhóm          | Tool/Resource                              | Mô tả                              |
| ------------- | ------------------------------------------- | ----------------------------------- |
| `docs_search` | tool                                         | Tìm trong tài liệu Mida (MiniSearch) |
| `ping`        | tool                                         | Health check                        |
| resources     | `mida-doc://index`, `mida-doc://page/{slug}` | Danh sách & nội dung từng trang doc  |

## Cài đặt

```bash
cd packages/mida-doc
npm install
cp .env.example .env   # điền JWT_SECRET / FIRECRAWL_API_KEY / MIDA_DOCS_URL
```

## Cấu hình `.env`

| Biến                 | Bắt buộc | Mô tả                                       |
| -------------------- | -------- | -------------------------------------------- |
| `MCP_TRANSPORT`      | ✓        | `http` (remote) hoặc `stdio` (local)         |
| `JWT_SECRET`         | khi http | Secret ≥ 16 ký tự                            |
| `FIRECRAWL_API_KEY`  | crawl    | API key Firecrawl                            |
| `MIDA_DOCS_URL`      | crawl    | URL trang docs để crawl                      |

## Chạy

```bash
npm start                       # HTTP mode (remote, cần JWT)
MCP_TRANSPORT=stdio npm start   # Stdio mode (local, Claude Desktop / Claude Code)
npm run dev                     # Dev với hot reload
```

## Crawl tài liệu

```bash
npm run crawl:docs    # Firecrawl → data/mida-doc/*.md
npm run docs:index    # Build MiniSearch index → data/mida-doc/index.json
```

## Cấu hình Claude Desktop / Claude Code

### Local (stdio)

Sao chép `.mcp.transport.example` (nếu có) hoặc tạo `.mcp.json` trỏ tới
`node src/index.js` với `MCP_TRANSPORT=stdio`. Stdio không cần JWT.

### Remote (HTTP)

Server chạy HTTP mode expose `POST http://<host>:<PORT>/mcp` (Streamable HTTP),
bảo vệ bằng **JWT Bearer**. Health check: `GET /healthz` (không cần auth).

```bash
MCP_TRANSPORT=http npm start
node scripts/gen-token.js claude-desktop 30d   # sinh JWT Bearer token
```

Sao chép `.mcp.http.example` → `.mcp.json`, điền `url` + token vào header
`Authorization`.

## License

ISC
