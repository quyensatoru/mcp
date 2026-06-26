import { createHash } from 'node:crypto';
import { getRedis } from '../config/redis.config.js';
import { env } from '../config/env.config.js';
import { logger } from '@mida/logger';

export function cacheKey(toolName, params) {
    const raw = toolName + ':' + JSON.stringify(params);
    return 'mcp:' + createHash('sha256').update(raw).digest('hex');
}

export async function withCache(key, ttl, fn) {
    const redis = getRedis();
    try {
        const cached = await redis.get(key);
        if (cached) return JSON.parse(cached);
    } catch {
        logger.info('Tool call result without cache');
    }

    const result = await fn();

    try {
        await redis.set(key, JSON.stringify(result), 'EX', ttl ?? env.CACHE_TTL);
    } catch (err) {
        logger.warn({ err }, 'Redis set failed');
    }

    return result;
}
