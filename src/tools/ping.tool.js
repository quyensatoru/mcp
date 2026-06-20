import { z } from 'zod';
import { okContent } from '../helpers/format.helper.js';

export function registerPingTool(server) {
    server.registerTool(
        'ping',
        {
            title: 'Ping',
            description: 'Kiểm tra MCP server hoạt động. Trả về pong + timestamp.',
            inputSchema: z.object({
                message: z.string().optional().describe('Tuỳ chọn: gửi kèm thông điệp'),
            }),
        },
        async ({ message }) => {
            return okContent({
                pong: true,
                ts: new Date().toISOString(),
                echo: message ?? null,
                server: 'mida-mcp v1.0.0',
            });
        },
    );
}
