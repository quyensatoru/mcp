import { query } from '@anthropic-ai/claude-agent-sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.config.js';
import { configService } from '@mida/console';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export const WORK_DIR = path.isAbsolute(env.WORK_DIR ?? '')
    ? env.WORK_DIR
    : path.resolve(REPO_ROOT, env.WORK_DIR ?? 'workspace');

export const SESSIONS_DIR = path.isAbsolute(env.SESSIONS_DIR ?? '')
    ? env.SESSIONS_DIR
    : path.resolve(REPO_ROOT, env.SESSIONS_DIR ?? 'sessions');

export const createClaudeAgent = async (prompt, sessionId, agentOptions = {}) => {
    const options = await configService.buildAgentOptions({
        cwd: agentOptions.workDir ?? WORK_DIR,
        sessionId: sessionId || undefined,
        canUseTool: agentOptions.canUseTool,
    });
    return { query: query({ prompt, options }) };
};
