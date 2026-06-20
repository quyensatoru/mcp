import { describe, it, expect } from 'vitest';
import { okContent, errorContent, toText } from '../../src/helpers/format.helper.js';

describe('format.helper', () => {
    it('okContent wraps data as text content', () => {
        const result = okContent({ foo: 'bar' });
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('foo');
    });

    it('okContent adds label heading', () => {
        const result = okContent({ x: 1 }, { label: 'Test Label' });
        expect(result.content[0].text).toMatch(/### Test Label/);
    });

    it('okContent redacts access_token', () => {
        const result = okContent({ access_token: 'secret123', name: 'shop' });
        expect(result.content[0].text).not.toContain('secret123');
        expect(result.content[0].text).toContain('[REDACTED]');
    });

    it('errorContent sets isError=true', () => {
        const result = errorContent('Something broke', 'Try this fix');
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Something broke');
        expect(result.content[0].text).toContain('Try this fix');
    });

    it('toText serialises JSON', () => {
        expect(toText({ a: 1 })).toContain('"a": 1');
    });
});
