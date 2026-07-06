import 'dotenv/config';
import { env } from './config/env.config.js';
import { logger } from '@mida/logger';
import { knowledgeService } from './config.js';
import { createMcpServer } from './server.js';

await knowledgeService.connect().catch((err) => {
    logger.error({ err }, '[knowledge] connect failed');
    process.exit(1);
});

if (env.MCP_TRANSPORT === 'stdio') {
    await startStdio();
} else {
    await startHttp();
}

async function startStdio() {
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const server = createMcpServer();
    await server.connect(new StdioServerTransport());
    logger.info('Knowledge MCP trên stdio');
}

async function startHttp() {
    const express = (await import('express')).default;
    const { StreamableHTTPServerTransport } =
        await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const { authMiddleware } = await import('./middleware/auth.middleware.js');

    const app = express();
    app.use(express.json());

    app.get('/healthz', (_req, res) => {
        res.json({ status: 'ok', server: 'knowledge', ts: new Date().toISOString() });
    });

    app.post('/mcp', authMiddleware, async (req, res) => {
        const server = createMcpServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on('close', () => {
            transport.close();
            server.close();
        });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            logger.error({ err }, 'MCP request failed');
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal server error' },
                    id: null,
                });
            }
        }
    });

    app.listen(env.PORT, () => {
        logger.info(`Knowledge MCP: http://localhost:${env.PORT}/mcp`);
    });
}
