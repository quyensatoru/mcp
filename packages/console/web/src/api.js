const TOKEN = import.meta.env.VITE_CONSOLE_TOKEN || '';
const API_URL = import.meta.env.VITE_API_URL;

const isLocal = location.protocol === 'http:';
export const WS_BASE = isLocal
    ? `ws://${location.hostname}:${import.meta.env.VITE_CONSOLE_PORT || 4000}`
    : `${API_URL.replace(/\/$/, '').replace(/^https:/, 'wss:')}`;

async function req(method, path, body) {
    const res = await fetch('/api' + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
        const msg = await res
            .json()
            .then((j) => j.error)
            .catch(() => res.statusText);
        throw new Error(msg || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
}

export const api = {
    getAll: () => req('GET', '/config'),
    patch: (domain, body) => req('PATCH', `/config/${domain}`, body),
    listMcp: () => req('GET', '/config/mcp-servers'),
    upsertMcp: (b) => req('POST', '/config/mcp-servers', b),
    delMcp: (n) => req('DELETE', `/config/mcp-servers/${encodeURIComponent(n)}`),
    listSubagents: () => req('GET', '/config/subagents'),
    upsertSubagent: (b) => req('POST', '/config/subagents', b),
    delSubagent: (n) => req('DELETE', `/config/subagents/${encodeURIComponent(n)}`),
    listSecrets: () => req('GET', '/config/secrets'),
    setSecret: (k, v) => req('PUT', `/config/secrets/${encodeURIComponent(k)}`, { value: v }),
    delSecret: (k) => req('DELETE', `/config/secrets/${encodeURIComponent(k)}`),
    reload: () => req('POST', '/config/reload'),

    chatSessions: () => req('GET', '/chat/sessions'),
    chatMessages: (sessionId) =>
        req('GET', `/chat/sessions/${encodeURIComponent(sessionId)}/messages`),

    sessions: () => req('GET', '/sessions'),
    tree: (session, repo, dir = '') =>
        req(
            'GET',
            `/files/tree?session=${encodeURIComponent(session)}&repo=${encodeURIComponent(repo)}&dir=${encodeURIComponent(dir)}`,
        ),
    readFile: (session, repo, file) =>
        req(
            'GET',
            `/files/read?session=${encodeURIComponent(session)}&repo=${encodeURIComponent(repo)}&file=${encodeURIComponent(file)}`,
        ),
    writeFile: (session, repo, file, content) =>
        req('PUT', '/files/write', { session, repo, file, content }),
    gitStatus: (session, repo) =>
        req(
            'GET',
            `/git/status?session=${encodeURIComponent(session)}&repo=${encodeURIComponent(repo)}`,
        ),
    gitDiff: (session, repo, file) =>
        req(
            'GET',
            `/git/diff?session=${encodeURIComponent(session)}&repo=${encodeURIComponent(repo)}&file=${encodeURIComponent(file)}`,
        ),
    gitCommit: (session, repo, message, files) =>
        req('POST', '/git/commit', { session, repo, message, files }),
};
