function textContent(text) {
    return { content: [{ type: 'text', text: String(text) }] };
}

function errorContent(message, hint) {
    const text = hint ? `❌ ${message}\n💡 ${hint}` : `❌ ${message}`;
    return { content: [{ type: 'text', text }], isError: true };
}

export { textContent, errorContent };
