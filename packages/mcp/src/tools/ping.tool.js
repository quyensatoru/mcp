import { z } from 'zod';
import { textContent } from '../helpers/format.helper.js';

export function registerPingTool(server) {
    server.registerTool(
        'ping',
        {
            title: 'Ping',
            description: 'Kiểm tra MCP server hoạt động.',
            inputSchema: z.object({
                message: z.string().optional().describe('Tuỳ chọn: thông điệp gửi kèm'),
            }),
        },
        async ({ message }) =>
            textContent(`pong · mida-mcp · ${new Date().toISOString()}${message ? ` · ${message}` : ''}`),
    );
}
