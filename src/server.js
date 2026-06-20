import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';
import { registerAllPrompts } from './prompts/index.js';

let _server = null;

export function createMcpServer() {
    if (_server) return _server;

    _server = new McpServer({
        name: 'mida-mcp',
        version: '1.0.0',
    });

    registerAllResources(_server);
    registerAllTools(_server);
    registerAllPrompts(_server);

    return _server;
}
