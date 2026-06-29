import http from 'node:http';
import { WebSocketServer } from 'ws';
import { env } from './server/env.js';
import { logger } from '@mida/logger';
import { configService } from './config/index.js';
import { createApp } from './server/app.js';
import { handleTerminal } from './server/ws/terminal.ws.js';
import { handleChat } from './server/chat.service.js';

const bootstrap = async () => {
    if (!env.MONGO_URI) {
        logger.error('[console] MONGO_URI is required to start the config server');
        process.exit(1);
    }

    await configService.connect(env.MONGO_URI, { ttlMs: env.CONFIG_TTL_MS });

    const app = createApp(configService, { token: env.CONSOLE_TOKEN });
    const server = http.createServer(app);

    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
        const { pathname } = new URL(req.url, 'http://localhost');
        if (pathname === '/ws/terminal') {
            wss.handleUpgrade(req, socket, head, (ws) => handleTerminal(ws, req));
        } else if (pathname === '/ws/chat') {
            wss.handleUpgrade(req, socket, head, (ws) => handleChat(ws, req));
        } else {
            socket.destroy();
        }
    });

    server.listen(env.CONSOLE_PORT, () => {
        logger.info(`🎛️  [console] dashboard + API at http://localhost:${env.CONSOLE_PORT}`);
        if (!env.CONSOLE_TOKEN) {
            logger.warn('[console] CONSOLE_TOKEN not set — /api is OPEN (dev mode)');
        }
    });
};

bootstrap();
