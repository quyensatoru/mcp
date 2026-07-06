import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const targetEntry = z.object({
    cluster: z.string(),
    conn: z.string(),
    capability: z.enum(['read', 'write', 'admin']).optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
});

// *_TARGETS là chuỗi JSON trong env → parse thành mảng target. Thiếu biến → mảng rỗng.
const targetList = z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}, z.array(targetEntry).default([]));

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3100),
    MCP_TRANSPORT: z.enum(['http', 'stdio']).default('http'),
    JWT_SECRET: z.string().min(16).optional(),

    MONGO_URI: z.string().url(),

    MONGO_TARGETS: targetList,
    RABBIT_TARGETS: targetList,
    REDIS_TARGETS: targetList,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid orchestrator environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
