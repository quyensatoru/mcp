import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    MATTERMOST_URL: z.string().url().optional(),
    MATTERMOST_USERNAME: z.string().optional(),
    MATTERMOST_TOKEN: z.string().optional(),
    MATTERMOST_CHANNEL_IDS: z
        .string()
        .optional()
        .transform((val) => val?.split(',') ?? []),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
