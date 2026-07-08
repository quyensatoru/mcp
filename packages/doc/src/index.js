import 'dotenv/config';
import { env } from './config/env.config.js';
import { logger } from '@mida/logger';
import { createMcpServer } from './server.js';

if (env.MCP_TRANSPORT === 'stdio') {
    await startStdio();
} else {
    await startHttp();
}

async function startStdio() {
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('MCP server running on stdio');
}

async function startHttp() {
    const express = (await import('express')).default;
    const { StreamableHTTPServerTransport } =
        await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const { authMiddleware } = await import('./middleware/auth.middleware.js');

    const app = express();
    app.use(express.json());

    app.get('/healthz', (_req, res) => {
        res.json({ status: 'ok', server: 'mida-doc', ts: new Date().toISOString() });
    });

    app.post('/mcp', authMiddleware, async (req, res) => {
        logger.info(`method: ${req.body?.method}, params: ${JSON.stringify(req.body?.params)}`);
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
        logger.info(`MCP server listening on http://localhost:${env.PORT}`);
        logger.info(`  Health: http://localhost:${env.PORT}/healthz`);
        logger.info(`  MCP:    http://localhost:${env.PORT}/mcp`);
    });
}
