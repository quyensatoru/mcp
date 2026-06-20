import { describe, it, expect } from 'vitest';
import { gzipSync } from 'node:zlib';
import { decompress } from '../../src/helpers/compress.helper.js';

describe('compress.helper', () => {
  it('returns falsy input unchanged', () => {
    expect(decompress(null)).toBeNull();
    expect(decompress(undefined)).toBeUndefined();
    expect(decompress('')).toBe('');
  });

  it('returns plain object if not base64-gzip', () => {
    const obj = { type: 3, x: 1 };
    expect(decompress(obj)).toEqual(obj);
  });

  it('decompresses { compressed: base64 } to JSON', () => {
    const payload = JSON.stringify({ type: 3, data: { x: 100 } });
    const b64 = gzipSync(Buffer.from(payload, 'utf8')).toString('base64');
    const result = decompress({ compressed: b64 });
    expect(result).toEqual({ type: 3, data: { x: 100 } });
  });
});
