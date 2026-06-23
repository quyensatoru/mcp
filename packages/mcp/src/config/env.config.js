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

    // Transport: http (StreamableHTTP) hoặc stdio (local dev)
    MCP_TRANSPORT: z.enum(['http', 'stdio']).default('http'),

    JWT_SECRET: z.string().min(16).optional(),

    PROXY_URI: z.string().url().optional(),
    API_URI_1: z.string().url().optional(),
    API_URI_2: z.string().url().optional(),
    HM_URI_1: z.string().url().optional(),
    HM_URI_2: z.string().url().optional(),
    RECORDER_URI_1: z.string().url().optional(),
    RECORDER_URI_2: z.string().url().optional(),

    REDIS_URL: z.string().optional(),
    CACHE_TTL: z.coerce.number().default(300),

    LOKI_URL: z.string().url().optional(),
    LOKI_TOKEN: z.string().optional(),
    LOKI_USER: z.string().optional(),
    LOKI_PASS: z.string().optional(),
    LOKI_ORG_ID: z.string().optional(),

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
