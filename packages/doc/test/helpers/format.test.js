import { describe, it, expect } from 'vitest';
import { abbreviate, textContent, errorContent } from '../../src/helpers/format.helper.js';

describe('format.helper', () => {
    it('abbreviate truncates to max length', () => {
        expect(abbreviate('a'.repeat(100), 10)).toHaveLength(10);
        expect(abbreviate('short', 10)).toBe('short');
    });

    it('textContent wraps plain text', () => {
        expect(textContent('hi').content[0]).toEqual({ type: 'text', text: 'hi' });
    });

    it('errorContent sets isError and includes hint', () => {
        const e = errorContent('broke', 'fix it');
        expect(e.isError).toBe(true);
        expect(e.content[0].text).toContain('broke');
        expect(e.content[0].text).toContain('fix it');
    });
});
