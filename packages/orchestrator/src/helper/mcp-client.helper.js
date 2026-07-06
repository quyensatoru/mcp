import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BIN_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../node_modules/.bin',
);

export async function connectTransport(target, spawnEnv = {}) {
    const client = new Client({ name: `orch-client-${target.name}`, version: '1.0.0' });

    if (target.transport === 'http') {
        const url = new URL(target.url ?? spawnEnv[target.env?.[0]?.name]);
        await client.connect(new StreamableHTTPClientTransport(url));
        return client;
    }

    const transport = new StdioClientTransport({
        command: target.command,
        args: target.args ?? [],
        env: {
            ...process.env,
            PATH: `${BIN_DIR}${path.delimiter}${process.env.PATH ?? ''}`,
            ...spawnEnv,
        },
    });
    await client.connect(transport);
    return client;
}
