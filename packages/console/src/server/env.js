import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Console's own .env wins; agent/.env is a fallback for shared values (MONGO_URI, tokens).
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../agent/.env') });

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CONSOLE_PORT: z.coerce.number().default(4000),
    // Bearer token guarding /api/*. Unset → API open (dev only).
    CONSOLE_TOKEN: z.string().optional(),
    MONGO_URI: z.string().optional(),
    // Cache TTL for cross-process config reads (standalone Mongo has no change stream).
    CONFIG_TTL_MS: z.coerce.number().default(30000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid console environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
