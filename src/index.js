import 'dotenv/config';
import { env } from './config/env.config.js';
import { logger } from './helpers/logger.js';
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
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );
  const { randomUUID } = await import('node:crypto');
  const { authMiddleware } = await import('./middleware/auth.middleware.js');

  const app = express();
  app.use(express.json());

  // Health check — không cần auth
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', server: 'mida-mcp', ts: new Date().toISOString() });
  });

  // MCP endpoint (Streamable HTTP) — protected
  app.all('/mcp', authMiddleware, async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(env.PORT, () => {
    logger.info(`MCP server listening on http://localhost:${env.PORT}`);
    logger.info(`  Health: http://localhost:${env.PORT}/healthz`);
    logger.info(`  MCP:    http://localhost:${env.PORT}/mcp`);
  });
}
