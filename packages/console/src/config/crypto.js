import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getKey() {
    const raw = process.env.CONSOLE_MASTER_KEY;
    if (!raw) return null;
    return crypto.createHash('sha256').update(raw).digest();
}

export function encrypt(plain) {
    const key = getKey();
    if (!key) return { value: plain, encrypted: false };

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const value = [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
    return { value, encrypted: true };
}

export function decrypt(stored) {
    if (!stored?.encrypted) return stored?.value ?? '';

    const key = getKey();
    if (!key) {
        return '';
    }

    const [iv, tag, enc] = String(stored.value).split(':');
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]).toString(
        'utf8',
    );
}
