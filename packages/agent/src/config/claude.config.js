import { query } from '@anthropic-ai/claude-agent-sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configService, env as claudeEnv } from '@mida/claude-config';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export const WORK_DIR = path.isAbsolute(claudeEnv.WORK_DIR ?? '')
    ? claudeEnv.WORK_DIR
    : path.resolve(REPO_ROOT, claudeEnv.WORK_DIR ?? 'workspace');

export const SESSIONS_DIR = path.isAbsolute(claudeEnv.SESSIONS_DIR ?? '')
    ? claudeEnv.SESSIONS_DIR
    : path.resolve(REPO_ROOT, claudeEnv.SESSIONS_DIR ?? 'sessions');

export const createClaudeAgent = async (prompt, sessionId, agentOptions = {}) => {
    const options = await configService.agent.buildOptions({
        cwd: agentOptions.workDir ?? WORK_DIR,
        sessionId: sessionId || undefined,
        canUseTool: agentOptions.canUseTool,
    });
    return { query: query({ prompt, options }) };
};
