import { z } from 'zod';
import { docsService } from '../services/docs.service.js';
import { okContent, errorContent } from '../helpers/format.helper.js';

export function registerDocsTool(server) {
  server.registerTool(
    'docs_search',
    {
      title: 'Docs Search',
      description: 'Tìm trong tài liệu Mida. Dùng trước khi điều tra để hiểu hành vi kỳ vọng của hệ thống.',
      inputSchema: z.object({
        query: z.string().describe('Từ khoá tìm kiếm (tiếng Anh hoặc tiếng Việt)'),
        topK: z.number().int().min(1).max(10).default(5).describe('Số kết quả trả về'),
      }),
    },
    async ({ query, topK }) => {
      try {
        const results = docsService.search(query, topK);
        if (!results.length) {
          return okContent({ results: [], note: 'Không tìm thấy. Thử từ khoá khác hoặc đọc mida-doc://index.' });
        }
        return okContent(
          results.map(r => ({
            slug: r.slug,
            title: r.title,
            url: r.url,
            excerpt: r.excerpt,
            resource: `mida-doc://page/${r.slug}`,
          })),
          { label: `Docs: "${query}" — ${results.length} kết quả` },
        );
      } catch (err) {
        return errorContent(`docs_search lỗi: ${err.message}`, 'Chạy npm run crawl:docs && npm run docs:index trước.');
      }
    },
  );
}
