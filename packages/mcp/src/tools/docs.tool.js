import { z } from 'zod';
import { docsService } from '../services/docs.service.js';
import { textContent, errorContent, abbreviate } from '../helpers/format.helper.js';
import { wrap } from '../helpers/tool.helper.js';

function formatResults(results, query) {
    if (!results.length)
        return `Không tìm thấy tài liệu cho "${query}". Thử từ khoá khác hoặc đọc mida-doc://index.`;
    const rows = results.map(
        (r, i) =>
            `${i + 1}. ${r.title}\n   ${abbreviate(r.excerpt, 160)}\n   ${r.url}\n   resource: mida-doc://page/${r.slug}`,
    );
    return [`Docs "${query}" — ${results.length} kết quả:`, '', ...rows].join('\n');
}

export function registerDocsTool(server) {
    server.registerTool(
        'docs_search',
        {
            title: 'Docs Search',
            description:
                'Tìm trong tài liệu Mida để hiểu hành vi kỳ vọng / trả lời khách. Dùng trước khi kết luận.',
            inputSchema: z.object({
                query: z.string().describe('Từ khoá (tiếng Anh hoặc tiếng Việt)'),
                topK: z.number().int().min(1).max(10).default(5),
            }),
        },
        wrap('docs_search', async ({ query, topK }) => {
            try {
                const results = docsService.search(query, topK);
                return textContent(formatResults(results, query));
            } catch (err) {
                return errorContent(
                    `docs_search: ${err.message}`,
                    'Chạy npm run crawl:docs && npm run docs:index trước.',
                );
            }
        }),
    );
}
