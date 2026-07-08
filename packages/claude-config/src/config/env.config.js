import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../agent/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../mattermost/.env') });

const envSchema = z.object({
    MONGO_URI: z.string().optional(),

    CLAUDE_MODEL: z.string().optional(),
    CLAUDE_MAX_TURNS: z.coerce.number().optional(),

    WORK_DIR: z.string().optional(),
    SESSIONS_DIR: z.string().optional(),

    MIDA_MCP_URL: z.string().url().optional(),
    MIDA_MCP_TOKEN: z.string().optional(),

    GITLAB_TOKEN: z.string().optional(),
    GITLAB_URL: z.string().url().default('https://gitlab.com'),
    GITLAB_PROJECT_ID: z.string().optional(),

    FIGMA_API_TOKEN: z.string().optional(),

    JIRA_USERNAME: z.string().optional(),
    JIRA_API_TOKEN: z.string().optional(),

    TWENTY_API_KEY: z.string().optional(),
    TWENTY_BASE_URL: z.string().optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    MATTERMOST_URL: z.string().url().optional(),
    MATTERMOST_TOKEN: z.string().optional(),
    MATTERMOST_TEAM: z.string().optional(),
    MATTERMOST_CHANNELS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid claude-config environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
