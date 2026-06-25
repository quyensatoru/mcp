import { env } from "./env.config.js";

export const mcpServers = {
    figma: {
        command: 'npx',
        args: ['-y', 'figma-developer-mcp', '--stdio'],
        env: {
            FIGMA_API_KEY: env.FIGMA_API_TOKEN,
        },
    },
    jira: {
        command: 'npx',
        args: ['-y', '@aashari/mcp-server-atlassian-jira'],
        env: {
            ATLASSIAN_SITE_NAME:  'mida-app',
            ATLASSIAN_USER_EMAIL: env.JIRA_USERNAME,
            ATLASSIAN_API_TOKEN:  env.JIRA_API_TOKEN,
        },
    },
    gitlab: {
        command: 'npx',
        args: [
            '-y',
            '@modelcontextprotocol/server-gitlab'
        ],
        env: {
            GITLAB_PERSONAL_ACCESS_TOKEN: env.GITLAB_TOKEN,
            GITLAB_API_URL: env.GITLAB_URL.replace(/\/$/, '') + '/api/v4'
        }
    },
    'twenty-crm': {
        command: 'npx',
        args: ['-y', 'twenty-crm-mcp-server'],
        env: {
            TWENTY_API_KEY:  env.TWENTY_API_KEY,
            TWENTY_BASE_URL: env.TWENTY_BASE_URL,
        },
    },
    'mida-rsa': {
        command: 'npx',
        args: [
            '-y',
            'mcp-remote',
            env.MIDA_MCP_URL,
            '--header',
            `Authorization:Bearer ${env.MIDA_MCP_TOKEN}`
        ]
    },
    'google-workspace': {
        command: 'npx',
        args: [
            '-y',
            'gws-mcp-server',
            '--services', 'gmail,drive,calendar'
        ],
        env: {
            GOOGLE_WORKSPACE_CLI_CLIENT_ID: env.GOOGLE_CLIENT_ID,
            GOOGLE_WORKSPACE_CLI_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
        }
    }
};
