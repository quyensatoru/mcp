import { describe, it, expect } from 'vitest';
import {
    pct,
    redact,
    abbreviate,
    maskEmail,
    textContent,
    errorContent,
} from '../../src/helpers/format.helper.js';

describe('format.helper', () => {
    it('pct computes percentage, — when denom 0', () => {
        expect(pct(45, 100)).toBe('45.0%');
        expect(pct(1, 0)).toBe('—');
    });

    it('redact masks secret keys deeply', () => {
        const r = redact({ access_token: 'x', nested: { token: 'y', ok: 1 } });
        expect(r.access_token).toBe('[REDACTED]');
        expect(r.nested.token).toBe('[REDACTED]');
        expect(r.nested.ok).toBe(1);
    });

    it('abbreviate truncates to max length', () => {
        expect(abbreviate('a'.repeat(100), 10)).toHaveLength(10);
        expect(abbreviate('short', 10)).toBe('short');
    });

    it('maskEmail masks local part', () => {
        expect(maskEmail('john@store.com')).toBe('jo***@store.com');
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
