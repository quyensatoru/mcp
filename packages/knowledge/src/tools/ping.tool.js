import { z } from 'zod';
import { textContent } from '../helper/format.helper.js';

export function registerPingTool(server) {
    server.registerTool(
        'ping',
        { title: 'Ping', description: 'Health check', inputSchema: z.object({}) },
        async () => textContent('pong'),
    );
}
