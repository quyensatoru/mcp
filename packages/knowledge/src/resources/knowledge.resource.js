import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { knowledgeService } from '../config.js';

function renderEntry(doc) {
    const lines = [`# ${doc.title ?? doc.key ?? doc._id}`, ``, `type: ${doc.type}`];
    if (doc.confidence) lines.push(`confidence: ${doc.confidence}`);
    if (doc.tags?.length) lines.push(`tags: ${doc.tags.join(', ')}`);
    lines.push('', doc.body ?? '');
    if (doc.data != null) lines.push('', '```json', JSON.stringify(doc.data, null, 2), '```');
    if (doc.refs?.length) {
        lines.push('', '## refs');
        for (const r of doc.refs) lines.push(`- ${r.repo ?? ''} ${r.symbol ?? ''} ${r.file ?? ''}`);
    }
    return lines.join('\n');
}

export function registerKnowledgeResources(server) {
    server.registerResource(
        'knowledge-index',
        'knowledge://index',
        {
            title: 'Knowledge Index',
            description: 'Danh sách knowledge (key, type, title, tags)',
            mimeType: 'application/json',
        },
        async (uri) => {
            const docs = await knowledgeService.entry.list({ limit: 200 });
            const items = docs.map((d) => ({
                key: d.key,
                type: d.type,
                title: d.title,
                tags: d.tags,
            }));
            return { contents: [{ uri: uri.href, text: JSON.stringify(items, null, 2) }] };
        },
    );

    server.registerResource(
        'knowledge-entry',
        new ResourceTemplate('knowledge://entry/{key}', {
            list: async () => {
                const docs = await knowledgeService.entry.list({ limit: 200 });
                return {
                    resources: docs
                        .filter((d) => d.key)
                        .map((d) => ({
                            uri: `knowledge://entry/${d.key}`,
                            name: d.title ?? d.key,
                            mimeType: 'text/markdown',
                        })),
                };
            },
        }),
        {
            title: 'Knowledge Entry',
            description: 'Nội dung một mục knowledge theo key',
            mimeType: 'text/markdown',
        },
        async (uri, { key }) => {
            const doc = await knowledgeService.entry.get(key);
            const text = doc ? renderEntry(doc) : `# Not found: ${key}`;
            return { contents: [{ uri: uri.href, text }] };
        },
    );
}
