const SECRET_KEY = /(access_token|password|passwd|secret|token|authorization|apikey|api_key)/i;

function textContent(text) {
    return { content: [{ type: 'text', text: String(text) }] };
}

function errorContent(message, hint) {
    const text = hint ? `❌ ${message}\n💡 ${hint}` : `❌ ${message}`;
    return { content: [{ type: 'text', text }], isError: true };
}

function redact(value) {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, val] of Object.entries(value)) {
            out[key] = SECRET_KEY.test(key) ? '[REDACTED]' : redact(val);
        }
        return out;
    }
    return value;
}

export { textContent, errorContent, redact };
