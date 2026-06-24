import { z } from 'zod';
import { docsService } from '../services/docs.service.js';
import { textContent, errorContent, abbreviate } from '../helpers/format.helper.js';
import { wrap } from '../helpers/tool.helper.js';

function formatResults(results, query) {
    if (!results.length)
        return `No docs found for "${query}". Try other keywords or read mida-doc://index.`;
    const rows = results.map(
        (r, i) =>
            `${i + 1}. ${r.title}\n   ${abbreviate(r.excerpt, 160)}\n   ${r.url}\n   resource: mida-doc://page/${r.slug}`,
    );
    return [`Docs "${query}" — ${results.length} results:`, '', ...rows].join('\n');
}

export function registerDocsTool(server) {
    server.registerTool(
        'docs_search',
        {
            title: 'Docs Search',
            description:
                'Search the Mida documentation (help center). Use to confirm the expected/correct behavior of a feature before concluding, or to back a customer-facing answer with an authoritative reference.',
            inputSchema: z.object({
                query: z.string().describe('Search keywords'),
                topK: z.number().int().min(1).max(10).default(5).describe('Number of results to return'),
            }),
        },
        wrap('docs_search', async ({ query, topK }) => {
            try {
                const results = docsService.search(query, topK);
                return textContent(formatResults(results, query));
            } catch (err) {
                return errorContent(
                    `docs_search: ${err.message}`,
                    'Run "npm run crawl:docs && npm run docs:index" first.',
                );
            }
        }),
    );
}
