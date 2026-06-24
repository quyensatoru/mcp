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
    'twenty-crm': {
        command: 'npx',
        args: ['-y', 'twenty-crm-mcp-server'],
        env: {
            TWENTY_API_KEY:  env.TWENTY_API_KEY,
            TWENTY_BASE_URL: env.TWENTY_BASE_URL,
        },
    },
};
