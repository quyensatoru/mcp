import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
    path: path.resolve(__dirname, '../../.env'),
});

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),

    MIDA_MCP_URL: z.string().url().optional(),
    MIDA_MCP_TOKEN: z.string().optional(),

    CLAUDE_MODEL: z.string().optional(),
    CLAUDE_MAX_TURNS: z.coerce.number().default(30),
    BOT_MAX_CONCURRENCY: z.coerce.number().default(3),

    MONGO_URI: z.string().optional(),
    WORK_DIR: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
