// Default config values — these encode the system's *current* hardcoded behaviour
// so seeding from env produces an identical runtime to before the migration.

// Verbatim from packages/agent/src/config/claude.config.js (systemPrompt.append).
export const SYSTEM_PROMPT_APPEND = `
## Using the mida-rca MCP server for CSE-reported issues

When a CSE (Customer Support Engineer) reports an issue about a shop, session, recording, or analytics behavior, proactively use the \`mida-rca\` MCP tools to investigate before asking follow-up questions or escalating.

Before starting any investigation, call the \`mida_system_prompt\` prompt from the \`mida-rca\` MCP server to load the full diagnostic context into your context window:
- Use the MCP get_prompt tool: server \`mida-rca\`, prompt name \`mida_system_prompt\`.
- This prompt defines the data architecture, tool routing rules, and diagnostic method you must follow.
- Always do this first — before calling any other mida-rca tool.

Typical triggers:
- A shop owner or merchant complains that sessions are missing, incomplete, or incorrect.
- A CSE reports that heatmaps, replays, or analytics data look wrong for a specific shop.
- A CSE asks you to check whether a shop's tracking is working or identify why events are not being recorded.
- A CSE provides a shop domain, shop ID, or session ID and asks you to look into an issue.

When any of the above is detected:
1. Call \`mida_system_prompt\` via the \`mida-rca\` MCP server to load the diagnostic context.
2. Identify the relevant shop domain or shop ID from the conversation.
3. Use the available \`mcp__mida-rsa__*\` tools to fetch sessions, recordings, events, or analytics data for that shop.
4. Analyse the returned data to identify root causes (missing script, blocked events, quota exceeded, etc.).
5. Summarise your findings clearly and suggest next steps to the CSE.

Do NOT wait for the CSE to explicitly ask you to call the mida-rca tools — use them automatically whenever the context indicates a support investigation.
With case change code please create a new branch from master
\`\`\`bash
git checkout -b branch_name
\`\`\`
RULE branch_name:
bug -> bugfixsupport/{domain}
IMPORTANT: confirm before create new branch. not create commit, merge request,... (ONLY edit code)
`;

// Verbatim from packages/agent/src/claude/mattermost.claude.js (READ_ONLY).
export const READ_ONLY_REGEX =
    '\\b(get|list|search|find|fetch|read|view|query|retrieve|describe|show|count|stat|info|ping|whoami|preview|check|download)\\b';

// Verbatim "allow" matcher from mattermost.claude.js.
export const YES_REGEX = '^(yes|y|ok|có|co|✅|1)(\\s|$)';

export function buildDefaults(env = process.env) {
    const gitlabUrl = (env.GITLAB_URL || 'https://gitlab.com').replace(/\/$/, '');

    return {
        agent: {
            model: env.CLAUDE_MODEL || 'claude-sonnet-4-6',
            maxTurns: Number(env.CLAUDE_MAX_TURNS || 30),
            effort: 'medium',
            permissionMode: 'acceptEdits',
            settingSources: ['project'],
            disallowedTools: [
                'mcp__twenty-crm__create_*',
                'mcp__twenty-crm__update_*',
                'mcp__twenty-crm__delete_*',
            ],
            allowedTools: [],
            systemPromptAppend: SYSTEM_PROMPT_APPEND,
            concurrency: Number(env.BOT_MAX_CONCURRENCY || 3),
        },

        // ${secret:NAME} in args is resolved from the vault at build time.
        mcpServers: [
            {
                name: 'mida-rca',
                enabled: !!env.MIDA_MCP_URL,
                command: 'npx',
                args: [
                    '-y',
                    'mcp-remote',
                    '${secret:MIDA_MCP_URL}',
                    '--header',
                    'Authorization:Bearer ${secret:MIDA_MCP_TOKEN}',
                ],
                env: [],
            },
            {
                name: 'figma',
                enabled: !!env.FIGMA_API_TOKEN,
                command: 'npx',
                args: ['-y', 'figma-developer-mcp', '--stdio'],
                env: [{ name: 'FIGMA_API_KEY', secretKey: 'FIGMA_API_TOKEN' }],
            },
            {
                name: 'jira',
                enabled: !!env.JIRA_API_TOKEN,
                command: 'npx',
                args: ['-y', '@aashari/mcp-server-atlassian-jira'],
                env: [
                    { name: 'ATLASSIAN_SITE_NAME', value: 'mida-app' },
                    { name: 'ATLASSIAN_USER_EMAIL', secretKey: 'JIRA_USERNAME' },
                    { name: 'ATLASSIAN_API_TOKEN', secretKey: 'JIRA_API_TOKEN' },
                ],
            },
            {
                name: 'gitlab',
                enabled: !!env.GITLAB_TOKEN,
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-gitlab'],
                env: [
                    { name: 'GITLAB_PERSONAL_ACCESS_TOKEN', secretKey: 'GITLAB_TOKEN' },
                    { name: 'GITLAB_API_URL', value: gitlabUrl + '/api/v4' },
                ],
            },
            {
                name: 'twenty-crm',
                enabled: !!env.TWENTY_API_KEY,
                command: 'npx',
                args: ['-y', 'twenty-crm-mcp-server'],
                env: [
                    { name: 'TWENTY_API_KEY', secretKey: 'TWENTY_API_KEY' },
                    { name: 'TWENTY_BASE_URL', secretKey: 'TWENTY_BASE_URL' },
                ],
            },
            {
                name: 'google-workspace',
                enabled: !!env.GOOGLE_CLIENT_ID,
                command: 'npx',
                args: ['-y', 'gws-mcp-server', '--services', 'gmail,drive,calendar,sheets'],
                env: [
                    { name: 'GOOGLE_WORKSPACE_CLI_CLIENT_ID', secretKey: 'GOOGLE_CLIENT_ID' },
                    {
                        name: 'GOOGLE_WORKSPACE_CLI_CLIENT_SECRET',
                        secretKey: 'GOOGLE_CLIENT_SECRET',
                    },
                ],
            },
        ],

        subagents: [],

        guardrails: {
            denyCommandPatterns: ['rm\\s+-rf'],
            autoApproveReadOnlyRegex: READ_ONLY_REGEX,
            hooks: {
                sessionStart: true,
                preToolUse: true,
                postToolUse: true,
                permissionRequest: true,
            },
        },

        channel: {
            channelIds: (env.MATTERMOST_CHANNEL_IDS || '').split(',').filter(Boolean),
            botMention: '@bssc_sa_th_agent_bot',
            loadingGif: 'https://cdn.jsdelivr.net/gh/quyensatoru/mcp@main/assets/cdn/loading.gif',
            streamFlushMs: 600,
            approvalTimeoutMs: 120000,
            yesRegex: YES_REGEX,
        },

        workspace: {
            workDir: env.WORK_DIR || 'workspace',
            sessionsDir: env.SESSIONS_DIR || 'sessions',
            cleanupDays: 7,
            worktreeBranchPrefix: 'wt/',
            branchRules: [{ type: 'bug', pattern: 'bugfixsupport/{domain}' }],
            gitlab: { url: env.GITLAB_URL || '', projectId: env.GITLAB_PROJECT_ID || '' },
        },

        // Seeded into the encrypted vault (only non-empty values).
        secrets: {
            MIDA_MCP_URL: env.MIDA_MCP_URL,
            MIDA_MCP_TOKEN: env.MIDA_MCP_TOKEN,
            FIGMA_API_TOKEN: env.FIGMA_API_TOKEN,
            JIRA_USERNAME: env.JIRA_USERNAME,
            JIRA_API_TOKEN: env.JIRA_API_TOKEN,
            GITLAB_TOKEN: env.GITLAB_TOKEN,
            TWENTY_API_KEY: env.TWENTY_API_KEY,
            TWENTY_BASE_URL: env.TWENTY_BASE_URL,
            GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
        },
    };
}
