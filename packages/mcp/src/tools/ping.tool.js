import { z } from 'zod';
import { textContent } from '../helpers/format.helper.js';

export function registerPingTool(server) {
    server.registerTool(
        'ping',
        {
            title: 'Ping',
            description:
                'Health check. Returns pong + server timestamp to verify the MCP server is reachable.',
            inputSchema: z.object({
                message: z.string().optional().describe('Optional message to echo back'),
            }),
        },
        async ({ message }) =>
            textContent(
                `pong · mida-mcp · ${new Date().toISOString()}${message ? ` · ${message}` : ''}`,
            ),
    );
}
