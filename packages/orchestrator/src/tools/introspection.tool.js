import { registry } from '../registry/registry.js';
import { textContent } from '../helper/format.helper.js';

const emptyInput = { type: 'object', properties: {} };

// Tool tự thân của orchestrator (read-only) — JSON Schema viết tay, không proxy.
export const INTROSPECTION_TOOLS = [
    { name: 'ping', description: 'Health check của orchestrator', inputSchema: emptyInput },
    {
        name: 'targets_list',
        description: 'Liệt kê các infra MCP downstream đang online + capability',
        inputSchema: emptyInput,
    },
    {
        name: 'catalog_list',
        description: 'Liệt kê mọi tool đã tổng hợp, gom theo target',
        inputSchema: emptyInput,
    },
];

const handlers = {
    ping: () => textContent('pong'),

    targets_list: () => {
        const rows = registry
            .targets()
            .map((t) => `- ${t.name} [${t.kind}/${t.cluster}] cap=${t.capability}`);
        return textContent(rows.length ? rows.join('\n') : 'Chưa có target online.');
    },

    catalog_list: () => {
        const cat = registry.catalog();
        console.log('[introspection] catalog_list', cat);
        if (!cat.length) return textContent('Catalog trống (chưa có downstream online).');

        const byTarget = {};
        for (const e of cat) (byTarget[e.target] ??= []).push(e.localName);

        const rows = Object.entries(byTarget).map(
            ([target, tools]) => `## ${target}\n` + tools.map((n) => `- ${n}`).join('\n'),
        );
        return textContent(rows.join('\n\n'));
    },
};

export function handleIntrospection(name) {
    const fn = handlers[name];
    return fn ? () => fn() : null;
}
