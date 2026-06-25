const SECRET_KEYS = new Set(['access_token', 'accessToken', 'password', 'secret', 'token', 'jwt']);

export function redact(value) {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [
                k,
                SECRET_KEYS.has(k) ? '[REDACTED]' : redact(v),
            ]),
        );
    }
    return value;
}

export const pct = (num, denom) => (denom ? `${((num / denom) * 100).toFixed(1)}%` : '—');

export function abbreviate(str, max = 80) {
    if (!str) return '';
    return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

export function maskEmail(email) {
    if (!email || !email.includes('@')) return email ?? '';
    const [name, host] = email.split('@');
    return `${name.slice(0, 2)}***@${host}`;
}

export function section(title, lines) {
    return [title, ...lines.filter(Boolean).map((l) => `  ${l}`)].join('\n');
}

export function textContent(text) {
    return { content: [{ type: 'text', text }] };
}

export function errorContent(message, hint) {
    return {
        isError: true,
        content: [{ type: 'text', text: hint ? `${message}\n\nGợi ý: ${hint}` : message }],
    };
}
