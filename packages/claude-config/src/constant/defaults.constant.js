export const READ_ONLY_REGEX =
    '\\b(get|list|search|find|fetch|read|view|query|retrieve|describe|show|count|stat|info|ping|whoami|preview|check|download)\\b';

export const YES_REGEX = '^(yes|y|ok|có|co|✅|1)(\\s|$)';

export function buildDefaults(env = process.env) {
    const gitlabUrl = (env.GITLAB_URL || 'https://gitlab.com').replace(/\/$/, '');

    return {
        agent: {
            model: env.CLAUDE_MODEL || 'claude-sonnet-4-6',
            maxTurns: Number(env.CLAUDE_MAX_TURNS || 30),
            effort: 'medium',
            permissionMode: 'acceptEdits',
            settingSources: ['project', 'user'],
            disallowedTools: [
                'mcp__twenty-crm__create_*',
                'mcp__twenty-crm__update_*',
                'mcp__twenty-crm__delete_*',
            ],
            allowedTools: [],
            systemPromptAppend: '',
        },

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
            loadingGif:
                '![](https://cdn.jsdelivr.net/gh/quyensatoru/mcp@main/assets/cdn/loading.gif)',
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
