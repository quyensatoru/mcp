import { describe, it, expect } from 'vitest';
import { parseDate, dateRangeFilter } from '../../src/helpers/validate.helper.js';

describe('validate.helper', () => {
    it('parseDate parses YYYY-MM-DD', () => {
        expect(parseDate('2024-01-15')).toBeInstanceOf(Date);
    });

    it('parseDate returns null for empty', () => {
        expect(parseDate(null)).toBeNull();
    });

    it('parseDate throws on invalid', () => {
        expect(() => parseDate('not-a-date')).toThrow();
    });

    it('dateRangeFilter builds $gte/$lte', () => {
        const r = dateRangeFilter('2024-01-01', '2024-01-31');
        expect(r.$gte).toBeInstanceOf(Date);
        expect(r.$lte).toBeInstanceOf(Date);
    });

    it('dateRangeFilter returns null when empty', () => {
        expect(dateRangeFilter()).toBeNull();
    });
});
