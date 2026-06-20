import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { docsService } from '../services/docs.service.js';

export function registerMidaDocResource(server) {
    server.registerResource(
        'mida-doc-index',
        'mida-doc://index',
        {
            title: 'Mida Docs Index',
            description: 'Danh sách toàn bộ trang tài liệu Mida (slug, title, url, excerpt)',
            mimeType: 'application/json',
        },
        async (uri) => ({ contents: [{ uri: uri.href, text: docsService.indexJson() }] }),
    );

    server.registerResource(
        'mida-doc-page',
        new ResourceTemplate('mida-doc://page/{slug}', {
            list: async () => docsService.listResources(),
        }),
        {
            title: 'Mida Doc Page',
            description: 'Nội dung markdown của một trang tài liệu Mida',
            mimeType: 'text/markdown',
        },
        async (uri, { slug }) => ({ contents: [{ uri: uri.href, text: docsService.read(slug) }] }),
    );
}
