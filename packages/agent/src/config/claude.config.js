import { query } from '@anthropic-ai/claude-agent-sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.config.js';
import { mcpServers } from '../config/mcp.config.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const WORK_DIR = path.isAbsolute(env.WORK_DIR ?? '')
    ? env.WORK_DIR
    : path.resolve(REPO_ROOT, env.WORK_DIR ?? 'workspace');
const CLAUDE_BIN = path.resolve(
    REPO_ROOT,
    'node_modules/.pnpm/@anthropic-ai+claude-agent-sdk-linux-x64@0.3.185/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude'
);

export const createClaudeAgent = (prompt, sessionId, agentOptions = {}) => {
    const agentQuery = query({
        prompt,
        options: {
            pathToClaudeCodeExecutable: CLAUDE_BIN,
            model: env.CLAUDE_MODEL,
            cwd: WORK_DIR,
            systemPrompt: {
                type: 'preset',
                preset: 'claude_code',
            },
            settingSources: ['project'],
            permissionMode: 'acceptEdits',
            ...(sessionId ? { resume: sessionId } : {}),
            mcpServers: mcpServers,
            maxTurns: env.CLAUDE_MAX_TURNS,
            effort: 'medium',
            disallowedTools: [
                'mcp__twenty-crm__create_*',
                'mcp__twenty-crm__update_*',
                'mcp__twenty-crm__delete_*',
            ],
            canUseTool: agentOptions.canUseTool,
        },
    });
    return { query: agentQuery };
};
