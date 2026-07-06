import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';

export function createMcpServer() {
    const server = new McpServer({ name: 'knowledge', version: '1.0.0' });
    registerAllResources(server);
    registerAllTools(server);
    return server;
}
