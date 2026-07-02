#!/usr/bin/env node
/* eslint-disable no-console -- CLI verification script, console output is the UX */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { configService } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reuse the agent's .env (MONGO_URI + tokens) until this package has its own.
dotenv.config({ path: path.resolve(__dirname, '../../agent/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGO_URI;
if (!uri) {
    console.error(
        '✗ MONGO_URI is not set (checked packages/agent/.env and packages/claude-config/.env)',
    );
    process.exit(1);
}

await configService.connect(uri);

console.log('\n✓ Config seeded / loaded. Effective runtime:\n');
console.log('  agent      :', await configService.agent.buildBase());
console.log('  mcpServers :', Object.keys(await configService.mcp.build()));
console.log('  subagents  :', Object.keys(await configService.subagent.build()));
console.log(
    '  secrets    :',
    (await configService.secret.list()).map((s) => s.key),
);
console.log('  channel    :', await configService.channel.get());
console.log('  workspace  :', await configService.workspace.get());
console.log('  guardrails :', await configService.guardrail.get());

process.exit(0);
