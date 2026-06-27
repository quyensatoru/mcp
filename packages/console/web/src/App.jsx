import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Overview from './pages/Overview.jsx';
import Agent from './pages/Agent.jsx';
import McpServers from './pages/McpServers.jsx';
import Subagents from './pages/Subagents.jsx';
import Guardrails from './pages/Guardrails.jsx';
import Mattermost from './pages/Mattermost.jsx';
import Workspace from './pages/Workspace.jsx';
import Secrets from './pages/Secrets.jsx';
import Chat from './pages/Chat.jsx';
import Files from './pages/Files.jsx';

const I = {
    grid: 'M1.5 1.5h5v5h-5zM9.5 1.5h5v5h-5zM1.5 9.5h5v5h-5zM9.5 9.5h5v5h-5z',
    agent: 'M8 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5',
    plug: 'M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M8 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
    sub: 'M5 2.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM11 8.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM5 7.2v1.6M7.2 5h1.6',
    shield: 'M8 1.5l5.5 2.3v3.7c0 3.4-2.3 5.8-5.5 7-3.2-1.2-5.5-3.6-5.5-7V3.8z',
    chat: 'M2 3.5h12v8H6l-3 2.5v-2.5H2z',
    folder: 'M2 4h4l1.5 2H14v7H2z',
    lock: 'M3 7h10v7H3zM5 7V5a3 3 0 0 1 6 0v2',
};

const NAV = [
    { group: 'Workspace' },
    { id: 'chat', label: 'Chat', icon: I.chat },
    { id: 'files', label: 'Files & Diff', icon: I.folder },
    { group: 'Control' },
    { id: 'overview', label: 'Overview', icon: I.grid },
    { id: 'agent', label: 'Agent', icon: I.agent },
    { id: 'mcp', label: 'MCP Servers', icon: I.plug, count: (d) => d.mcpServers.length },
    { id: 'subagents', label: 'Subagents', icon: I.sub, count: (d) => d.subagents.length },
    { id: 'guardrails', label: 'Guardrails', icon: I.shield },
    { group: 'Integrations' },
    { id: 'mattermost', label: 'Mattermost', icon: I.chat },
    { id: 'workspace', label: 'Workspace', icon: I.folder },
    { id: 'secrets', label: 'Secrets', icon: I.lock, count: (d) => d.secrets.length },
];

const TITLES = {
    chat: 'Chat',
    files: 'Files & Diff',
    overview: 'Overview',
    agent: 'Agent',
    mcp: 'MCP Servers',
    subagents: 'Subagents',
    guardrails: 'Guardrails',
    mattermost: 'Mattermost',
    workspace: 'Workspace',
    secrets: 'Secrets',
};

export default function App() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [view, setView] = useState('overview');
    const [health, setHealth] = useState(null);

    const reload = useCallback(async () => {
        try {
            setData(await api.getAll());
            setError(null);
        } catch (e) {
            setError(e.message);
        }
    }, []);

    useEffect(() => {
        reload();
        fetch('/api/health')
            .then((r) => r.json())
            .then(setHealth)
            .catch(() => setHealth({ ok: false }));
    }, [reload]);

    const pageProps = { data, api, reload };
    const isApp = view === 'files' || view === 'chat';
    const Page = {
        chat: Chat,
        files: Files,
        overview: Overview,
        agent: Agent,
        mcp: McpServers,
        subagents: Subagents,
        guardrails: Guardrails,
        mattermost: Mattermost,
        workspace: Workspace,
        secrets: Secrets,
    }[view];

    return (
        <div className="app">
            <aside className="side">
                <div className="brand">
                    <div className="mark" />
                    <div>
                        <h1>Mida Console</h1>
                        <small>control-plane</small>
                    </div>
                </div>
                <nav className="nav">
                    {NAV.map((n, i) =>
                        n.group ? (
                            <div className="grp" key={'g' + i}>
                                {n.group}
                            </div>
                        ) : (
                            <button
                                key={n.id}
                                className={'navlink' + (view === n.id ? ' on' : '')}
                                onClick={() => setView(n.id)}
                            >
                                <svg
                                    className="ic"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                >
                                    <path d={n.icon} />
                                </svg>
                                {n.label}
                                {n.count && data && <span className="badge">{n.count(data)}</span>}
                            </button>
                        ),
                    )}
                </nav>
                <div className="foot">
                    <div className="av">QV</div>
                    <div className="who">
                        <b>quyenpv</b>
                        <span>bsscommerce.com</span>
                    </div>
                </div>
            </aside>

            <div className={'main' + (view === 'files' ? ' ide' : '')}>
                <header className="top">
                    <div className="crumb">
                        Mida Console <b>/ {TITLES[view]}</b>
                    </div>
                    <div className="sp" />
                    <button
                        className="btn sm"
                        title="Xóa cache config trên server (áp dụng ngay thay đổi từ DB)"
                        onClick={async () => {
                            try {
                                await api.reload();
                                await reload();
                            } catch (e) {
                                alert(e.message);
                            }
                        }}
                    >
                        ↻ Reload
                    </button>
                    <span className="pill">
                        <span className={'dot ' + (health?.ok ? 'g' : 'r')} />
                        {health?.ready ? 'config ready' : health?.ok ? 'starting' : 'offline'}
                    </span>
                </header>

                <div className={'stage' + (isApp ? ' fill' : '')}>
                    {error && (
                        <div className="wrap">
                            <div
                                className="note"
                                style={{
                                    background: 'var(--crit-wash)',
                                    borderColor: '#f1cdcd',
                                    color: '#8a2b2b',
                                }}
                            >
                                Không tải được config: {error}. Kiểm tra server console (cổng 4000)
                                đang chạy.
                            </div>
                        </div>
                    )}
                    {!data && !error && (
                        <div className="center-msg">
                            <span className="spin" />
                        </div>
                    )}
                    {data && Page && <Page {...pageProps} />}
                </div>
            </div>
        </div>
    );
}
