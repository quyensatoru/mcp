import { gunzipSync } from 'node:zlib';

export function decompress(fieldValue) {
    if (!fieldValue) return fieldValue;
    if (fieldValue.compressed) {
        const buffer = gunzipSync(Buffer.from(fieldValue.compressed, 'base64'));
        return JSON.parse(buffer.toString('utf8'));
    }
    return fieldValue;
}
