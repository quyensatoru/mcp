import { Card } from '../ui.jsx';

function Metric({ label, val, sub }) {
    return (
        <div className="metric">
            <div className="lbl">{label}</div>
            <div className="val">{val}</div>
            <div className="sub">{sub}</div>
        </div>
    );
}

export default function Overview({ data }) {
    const enabled = data.mcpServers.filter((s) => s.enabled).length;
    const ws = data.workspace;
    return (
        <div className="wrap">
            <div className="phead">
                <div>
                    <h2>Overview</h2>
                    <p>Cấu hình động đang áp dụng cho agent (đọc trực tiếp từ MongoDB).</p>
                </div>
            </div>

            <div className="grid-m">
                <Metric
                    label="MCP servers"
                    val={`${enabled} / ${data.mcpServers.length}`}
                    sub="enabled / total"
                />
                <Metric label="Subagents" val={data.subagents.length} sub="đã định nghĩa" />
                <Metric label="Secrets" val={data.secrets.length} sub="trong vault" />
            </div>

            <Card title="Agent runtime" desc="Giá trị áp dụng cho mọi session mới">
                <div className="fgrid">
                    <Row k="Model" v={data.agent.model} />
                    <Row k="Max turns" v={data.agent.maxTurns} />
                    <Row k="Effort" v={data.agent.effort} />
                    <Row k="Permission mode" v={data.agent.permissionMode} />
                </div>
            </Card>

            <Card title="MCP servers">
                <div style={{ margin: '-18px' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Server</th>
                                <th>Command</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.mcpServers.map((s) => (
                                <tr key={s.name}>
                                    <td>
                                        <b>{s.name}</b>
                                    </td>
                                    <td className="mono" style={{ color: 'var(--muted)' }}>
                                        {s.command} {(s.args || []).join(' ')}
                                    </td>
                                    <td>
                                        <span className={'tag ' + (s.enabled ? 'ok' : 'idle')}>
                                            {s.enabled ? 'enabled' : 'disabled'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card title="Workspace">
                <div className="fgrid">
                    <Row k="Work dir" v={ws.workDir} mono />
                    <Row k="Sessions dir" v={ws.sessionsDir} mono />
                    <Row k="Cleanup" v={`${ws.cleanupDays} ngày`} />
                    <Row
                        k="GitLab"
                        v={`${ws.gitlab?.url || '—'} · #${ws.gitlab?.projectId || '—'}`}
                        mono
                    />
                </div>
            </Card>
        </div>
    );
}

function Row({ k, v, mono }) {
    return (
        <div className="field">
            <span className="hint">{k}</span>
            <span className={mono ? 'mono' : ''} style={{ fontWeight: 600 }}>
                {String(v ?? '—')}
            </span>
        </div>
    );
}
