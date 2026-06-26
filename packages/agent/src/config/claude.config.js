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
    'node_modules/.pnpm/@anthropic-ai+claude-agent-sdk-linux-x64@0.3.185/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude',
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
                append: [
                    `
## Using the mida-rsa MCP server for CSE-reported issues

When a CSE (Customer Support Engineer) reports an issue about a shop, session, recording, or analytics behavior, proactively use the \`mida-rsa\` MCP tools to investigate before asking follow-up questions or escalating.

Before starting any investigation, call the \`mida_system_prompt\` prompt from the \`mida-rsa\` MCP server to load the full diagnostic context into your context window:
- Use the MCP get_prompt tool: server \`mida-rsa\`, prompt name \`mida_system_prompt\`.
- This prompt defines the data architecture, tool routing rules, and diagnostic method you must follow.
- Always do this first — before calling any other mida-rsa tool.

Typical triggers:
- A shop owner or merchant complains that sessions are missing, incomplete, or incorrect.
- A CSE reports that heatmaps, replays, or analytics data look wrong for a specific shop.
- A CSE asks you to check whether a shop's tracking is working or identify why events are not being recorded.
- A CSE provides a shop domain, shop ID, or session ID and asks you to look into an issue.

When any of the above is detected:
1. Call \`mida_system_prompt\` via the \`mida-rsa\` MCP server to load the diagnostic context.
2. Identify the relevant shop domain or shop ID from the conversation.
3. Use the available \`mcp__mida-rsa__*\` tools to fetch sessions, recordings, events, or analytics data for that shop.
4. Analyse the returned data to identify root causes (missing script, blocked events, quota exceeded, etc.).
5. Summarise your findings clearly and suggest next steps to the CSE.

Do NOT wait for the CSE to explicitly ask you to call the mida-rsa tools — use them automatically whenever the context indicates a support investigation.
With case change code please create a new branch from master 
\`\`\`bash
git checkout -b branch_name
\`\`\`
RULE branch_name:
bug -> bugfixsupport/{domain}
IMPORTANT: confirm before create new branch. not create commit, merge request,... (ONLY edit code)
`,
                ].join(''),
            },
            settingSources: ['project', 'user'],
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
