// Rút gọn kết quả để tiết kiệm token khi trả về AI

const REDACT_FIELDS = new Set(['access_token', 'password', 'secret', 'token']);

function redact(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(redact);
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, REDACT_FIELDS.has(k) ? '[REDACTED]' : redact(v)]),
    );
}

export function formatDocs(docs, { maxItems = 50, pick } = {}) {
    const items = docs.slice(0, maxItems);
    const result = pick ? items.map((d) => pickFields(d, pick)) : items;
    return redact(result);
}

export function pickFields(obj, fields) {
    if (!fields?.length) return obj;
    return Object.fromEntries(fields.filter((f) => f in obj).map((f) => [f, obj[f]]));
}

export function summarize(docs, groupBy) {
    if (!groupBy) return { count: docs.length };
    const groups = {};
    for (const doc of docs) {
        const key = String(doc[groupBy] ?? 'unknown');
        groups[key] = (groups[key] ?? 0) + 1;
    }
    return { count: docs.length, by: groups };
}

export function toText(data) {
    return JSON.stringify(data, null, 2);
}

export function errorContent(message, hint) {
    return {
        isError: true,
        content: [{ type: 'text', text: hint ? `${message}\n\nGợi ý: ${hint}` : message }],
    };
}

export function okContent(data, { label } = {}) {
    const text = typeof data === 'string' ? data : toText(redact(data));
    return { content: [{ type: 'text', text: label ? `### ${label}\n\n${text}` : text }] };
}
