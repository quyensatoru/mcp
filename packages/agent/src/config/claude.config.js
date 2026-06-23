import { query } from "@anthropic-ai/claude-agent-sdk";
import { env } from "../config/env.config";
import { mcpServers } from "../config/mcp.config.js"
import { subAgents } from '../config/subagent.config.js';

export const createClaudeAgent = (prompt, sessionId) => {
    return {
        query: query({
            prompt,
            options: {
                model: env.CLAUDE_MODEL,
                cwd: env.WORK_DIR,
                systemPrompt: {
                    type: 'preset',
                    preset: 'claude_code',
                    append: [],
                },
                settingSources: ['project', 'user'],
                permissionMode: 'acceptEdits',
                ...(sessionId ? { sessionId } : {}),
                mcpServers: mcpServers,
                agents: subAgents,
                maxTurns: env.CLAUDE_MAX_TURNS,
                effort: 'medium',
            },
        })
    };
};
