import { gunzipSync } from 'node:zlib';

// Giải nén dữ liệu rrweb Event.data / Snapshot.type2 (gzip + base64)
export function decompress(fieldValue) {
  if (!fieldValue) return fieldValue;
  if (fieldValue.compressed) {
    const buffer = gunzipSync(Buffer.from(fieldValue.compressed, 'base64'));
    return JSON.parse(buffer.toString('utf8'));
  }
  return fieldValue;
}
