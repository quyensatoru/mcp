export function abbreviate(str, max = 80) {
    if (!str) return '';
    return str.length > max ? `${str.slice(0, max - 1)}…` : str;
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
