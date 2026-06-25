import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';
import { registerAllPrompts } from './prompts/index.js';

// Tạo instance MCP server mới cho mỗi request (stateless — xem index.js).
// Một McpServer chỉ connect được tới đúng 1 transport, nên không tái dùng singleton.
export function createMcpServer() {
    const server = new McpServer({
        name: 'mida-rsa',
        version: '1.0.0',
    });

    registerAllResources(server);
    registerAllTools(server);
    registerAllPrompts(server);

    return server;
}
