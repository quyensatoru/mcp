import { describe, it, expect, vi } from 'vitest';

// Mock fs so we don't need real files
vi.mock('node:fs', () => ({
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '[]'),
}));

vi.mock('dotenv/config', () => ({}));
vi.mock('../../src/config/env.config.js', () => ({
    env: {},
}));

describe('docs.service', () => {
    it('indexJson returns empty array when index.json missing', async () => {
        const { docsService } = await import('../../src/services/docs.service.js');
        const result = docsService.indexJson();
        expect(result).toBe('[]');
    });

    it('search returns empty array when no docs indexed', async () => {
        const { docsService } = await import('../../src/services/docs.service.js');
        const result = docsService.search('session recording');
        expect(Array.isArray(result)).toBe(true);
    });
});
