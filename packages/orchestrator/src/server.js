import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@mida/logger';
import { registry } from './registry/registry.js';
import { guard } from './helper/guard.helper.js';
import { INTROSPECTION_TOOLS, handleIntrospection } from './tools/introspection.tool.js';
import { errorContent } from './helper/format.helper.js';

export function createMcpServer() {
    const server = new Server(
        { name: 'orchestrator', version: '1.0.0' },
        { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const proxied = registry.catalog().map((e) => ({
            name: e.localName,
            description: `[${e.target}] ${e.description || e.tool}`,
            inputSchema: e.inputSchema,
        }));
        return { tools: [...INTROSPECTION_TOOLS, ...proxied] };
    });

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const { name, arguments: args } = req.params;

        const intro = handleIntrospection(name);
        if (intro) return intro();

        const e = registry.entry(name);
        if (!e) return errorContent(`unknown tool: ${name}`);

        const verdict = guard.check(e.tool, e.target.capability);
        if (!verdict.allow)
            return errorContent(`guard blocked capability ${name}: ${verdict.reason}`);

        try {
            return await registry.callTool(name, args);
        } catch (err) {
            logger.warn({ err }, `call ${name} lỗi`);
            return errorContent(`${name}: ${err.message}`);
        }
    });

    return server;
}
