import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
    path: path.resolve(__dirname, '../../.env'),
});

const envSchema = z.object({
    MATTERMOST_URL: z.string().url().optional(),
    MATTERMOST_USERNAME: z.string().optional(),
    MATTERMOST_PASSWORD: z.string().optional(),
    MATTERMOST_TOKEN: z.string().optional(),
    MATTERMOST_CHANNEL_IDS: z
        .string()
        .optional()
        .transform((val) => val?.split(',').filter(Boolean) ?? []),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
