import { query } from '@anthropic-ai/claude-agent-sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.config.js';
import { mcpServers } from '../config/mcp.config.js';
import { subAgents } from '../config/subagent.config.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const WORK_DIR = path.isAbsolute(env.WORK_DIR ?? '')
    ? env.WORK_DIR
    : path.resolve(REPO_ROOT, env.WORK_DIR ?? 'workspace');
const CLAUDE_BIN = path.resolve(
    REPO_ROOT,
    'node_modules/.pnpm/@anthropic-ai+claude-agent-sdk-linux-x64@0.3.185/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude'
);

export const createClaudeAgent = (prompt, sessionId) => {
    const agentQuery = query({
        prompt,
        options: {
            pathToClaudeCodeExecutable: CLAUDE_BIN,
            model: env.CLAUDE_MODEL,
            cwd: WORK_DIR,
            // systemPrompt: {
            //     type: 'preset',
            //     preset: 'claude_code',
            //     append: [],
            // },
            // settingSources: ['project', 'user'],
            // permissionMode: 'acceptEdits',
            // ...(sessionId ? { sessionId } : {}),
            // mcpServers: mcpServers,
            // agents: subAgents,
            maxTurns: env.CLAUDE_MAX_TURNS,
            effort: 'medium',
        },
    })
    return { query: agentQuery };
};
