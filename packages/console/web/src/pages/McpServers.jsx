import { useState } from 'react';
import { Card, Toggle } from '../ui.jsx';
import Empty, { ICON } from '../components/Empty.jsx';

const BLANK = { name: '', enabled: true, command: 'npx', args: [], env: [], order: 99 };

export default function McpServers({ data, api, reload }) {
    const [editing, setEditing] = useState(null); // { name, json } | null
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const servers = data.mcpServers;

    const toggle = async (s) => {
        await api.upsertMcp({ name: s.name, enabled: !s.enabled });
        await reload();
    };

    const openEdit = (s) => {
        setErr('');
        const { _id, createdAt, updatedAt, __v, ...clean } = s; // eslint-disable-line no-unused-vars
        setEditing({ name: s.name, json: JSON.stringify(clean, null, 2) });
    };

    const openAdd = () => {
        setErr('');
        setEditing({ name: '', json: JSON.stringify(BLANK, null, 2) });
    };

    const saveEdit = async () => {
        setBusy(true);
        setErr('');
        try {
            const obj = JSON.parse(editing.json);
            if (!obj.name) throw new Error('Thiếu "name"');
            await api.upsertMcp(obj);
            setEditing(null);
            await reload();
        } catch (e) {
            setErr(e.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async (name) => {
        if (!confirm(`Xóa server "${name}"?`)) return;
        await api.delMcp(name);
        await reload();
    };

    return (
        <div className="wrap">
            <div className="phead">
                <div>
                    <h2>MCP Servers</h2>
                    <p>
                        Bật/tắt, sửa command &amp; env, hoặc thêm server mới. Secret tham chiếu qua
                        ${'{secret:NAME}'}.
                    </p>
                </div>
                <div className="sp" />
                <button className="btn pri" onClick={openAdd}>
                    + Add server
                </button>
            </div>

            {!servers.length ? (
                <Empty
                    inline
                    icon={ICON.mcp}
                    title="Chưa có MCP server"
                    hint="Thêm server để agent gọi tool ngoài (Jira, GitLab, mida-rsa…). Bấm + Add server."
                />
            ) : (
                <Card>
                    <div style={{ margin: '-18px' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 50 }} />
                                    <th>Server</th>
                                    <th>Command</th>
                                    <th>Env / secrets</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {servers.map((s) => (
                                    <tr
                                        key={s.name}
                                        style={s.enabled ? undefined : { opacity: 0.6 }}
                                    >
                                        <td>
                                            <Toggle
                                                on={s.enabled}
                                                onChange={() => toggle(s)}
                                                label={s.name}
                                            />
                                        </td>
                                        <td>
                                            <b>{s.name}</b>
                                            <div
                                                className="mono"
                                                style={{ color: 'var(--muted)', fontSize: 11 }}
                                            >
                                                {s.transport || 'stdio'}
                                            </div>
                                        </td>
                                        <td
                                            className="mono"
                                            style={{ color: 'var(--muted)', maxWidth: 320 }}
                                        >
                                            {s.command} {(s.args || []).join(' ')}
                                        </td>
                                        <td>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    gap: 6,
                                                }}
                                            >
                                                {(s.env || []).map((e) => (
                                                    <span
                                                        className={
                                                            'chip' + (e.secretKey ? ' key' : '')
                                                        }
                                                        key={e.name}
                                                    >
                                                        {e.name}
                                                    </span>
                                                ))}
                                                {!(s.env || []).length && (
                                                    <span style={{ color: 'var(--faint)' }}>—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <button className="btn sm" onClick={() => openEdit(s)}>
                                                Sửa
                                            </button>{' '}
                                            <button
                                                className="btn sm danger"
                                                onClick={() => remove(s.name)}
                                            >
                                                Xóa
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {editing && (
                <Card
                    title={editing.name ? `Sửa: ${editing.name}` : 'Server mới'}
                    desc="JSON: name, enabled, command, args[], env[{name,value|secretKey}]"
                >
                    <textarea
                        className="inp"
                        style={{ minHeight: 260, fontSize: 12.5 }}
                        value={editing.json}
                        onChange={(e) => setEditing({ ...editing, json: e.target.value })}
                    />
                    {err && (
                        <div
                            className="note"
                            style={{
                                marginTop: 12,
                                background: 'var(--crit-wash)',
                                borderColor: '#f1cdcd',
                                color: '#8a2b2b',
                            }}
                        >
                            {err}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button className="btn pri" onClick={saveEdit} disabled={busy}>
                            {busy ? 'Đang lưu…' : 'Lưu'}
                        </button>
                        <button className="btn" onClick={() => setEditing(null)} disabled={busy}>
                            Hủy
                        </button>
                    </div>
                </Card>
            )}
        </div>
    );
}
