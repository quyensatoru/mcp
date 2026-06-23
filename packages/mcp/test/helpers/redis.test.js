import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock redis before importing helper
vi.mock('../../src/config/redis.config.js', () => ({
    getRedis: vi.fn(() => ({
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
    })),
}));

vi.mock('dotenv/config', () => ({}));
vi.mock('../../src/config/env.config.js', () => ({
    env: { REDIS_URL: 'redis://localhost:6379', CACHE_TTL: 300 },
}));

describe('redis.helper', () => {
    it('cacheKey is stable for same input', async () => {
        const { cacheKey } = await import('../../src/helpers/redis.helper.js');
        const k1 = cacheKey('tool', { a: 1, b: 2 });
        const k2 = cacheKey('tool', { a: 1, b: 2 });
        expect(k1).toBe(k2);
        expect(k1).toMatch(/^mcp:[a-f0-9]{64}$/);
    });

    it('cacheKey differs for different params', async () => {
        const { cacheKey } = await import('../../src/helpers/redis.helper.js');
        const k1 = cacheKey('tool', { domain: 'a.myshopify.com' });
        const k2 = cacheKey('tool', { domain: 'b.myshopify.com' });
        expect(k1).not.toBe(k2);
    });
});
