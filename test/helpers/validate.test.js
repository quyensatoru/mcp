import { describe, it, expect } from 'vitest';
import { parseTime, assertSafePipeline } from '../../src/helpers/validate.helper.js';

describe('validate.helper', () => {
  it('parseTime parses ISO string', () => {
    const result = parseTime('2024-01-15T00:00:00Z');
    expect(result).toBeInstanceOf(Date);
  });

  it('parseTime parses relative "now-2h"', () => {
    const result = parseTime('now-2h');
    expect(result).toBeInstanceOf(Date);
    const diffMs = Date.now() - result.getTime();
    expect(diffMs).toBeGreaterThan(7190000);
    expect(diffMs).toBeLessThan(7210000);
  });

  it('assertSafePipeline throws on $out', () => {
    expect(() => assertSafePipeline([{ $out: 'col' }])).toThrow();
  });

  it('assertSafePipeline throws on $merge', () => {
    expect(() => assertSafePipeline([{ $merge: {} }])).toThrow();
  });

  it('assertSafePipeline allows $match and $group', () => {
    expect(() => assertSafePipeline([{ $match: {} }, { $group: { _id: '$x' } }])).not.toThrow();
  });
});
