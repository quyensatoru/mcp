import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    MCP_TRANSPORT: z.enum(['http', 'stdio']).default('http'),

    JWT_SECRET: z.string().min(16).optional(),

    PROXY_URI: z.string().url(),
    API_URI_1: z.string().url(),
    API_URI_2: z.string().url(),
    HM_URI_1: z.string().url(),
    HM_URI_2: z.string().url(),
    RECORDER_URI_1: z.string().url(),
    RECORDER_URI_2: z.string().url(),

    REDIS_URL: z.string().optional(),
    CACHE_TTL: z.coerce.number().default(300),

    FIRECRAWL_API_KEY: z.string().optional(),
    MIDA_DOCS_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
