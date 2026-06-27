import { useState } from 'react';
import { Card, Field, Text, Toggle } from '../ui.jsx';
import Empty, { ICON } from '../components/Empty.jsx';

const BLANK = { name: '', description: '', prompt: '', model: '', tools: [], enabled: true };

export default function Subagents({ data, api, reload }) {
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const subs = data.subagents;

    const save = async () => {
        setBusy(true);
        try {
            await api.upsertSubagent({
                ...form,
                tools:
                    typeof form.tools === 'string'
                        ? form.tools
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean)
                        : form.tools,
            });
            setForm(null);
            await reload();
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async (name) => {
        if (!confirm(`Xóa subagent "${name}"?`)) return;
        await api.delSubagent(name);
        await reload();
    };

    return (
        <div className="wrap">
            <div className="phead">
                <div>
                    <h2>Subagents</h2>
                    <p>
                        Định nghĩa subagent (name, description, prompt, model, tools) — wire vào
                        option `agents`.
                    </p>
                </div>
                <div className="sp" />
                <button className="btn pri" onClick={() => setForm({ ...BLANK })}>
                    + Subagent
                </button>
            </div>

            {!subs.length && !form && (
                <Empty
                    inline
                    icon={ICON.subagents}
                    title="Chưa có subagent"
                    hint="Subagent giúp agent chính ủy thác việc chuyên biệt (mỗi cái có prompt/model/tools riêng). Bấm + Subagent để tạo."
                />
            )}

            {subs.map((s) => (
                <Card key={s.name}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Toggle
                            on={s.enabled}
                            onChange={async () => {
                                await api.upsertSubagent({ name: s.name, enabled: !s.enabled });
                                await reload();
                            }}
                        />
                        <div style={{ flex: 1 }}>
                            <b>{s.name}</b>
                            {s.model && (
                                <span className="chip" style={{ marginLeft: 8 }}>
                                    {s.model}
                                </span>
                            )}
                            <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>
                                {s.description}
                            </div>
                        </div>
                        <button
                            className="btn sm"
                            onClick={() =>
                                setForm({ ...BLANK, ...s, tools: (s.tools || []).join(', ') })
                            }
                        >
                            Sửa
                        </button>
                        <button className="btn sm danger" onClick={() => remove(s.name)}>
                            Xóa
                        </button>
                    </div>
                    {s.prompt && (
                        <div
                            className="mono"
                            style={{
                                marginTop: 10,
                                color: 'var(--muted)',
                                fontSize: 12,
                                whiteSpace: 'pre-wrap',
                            }}
                        >
                            {s.prompt.slice(0, 240)}
                            {s.prompt.length > 240 ? '…' : ''}
                        </div>
                    )}
                </Card>
            ))}

            {form && (
                <Card title={form._id ? `Sửa: ${form.name}` : 'Subagent mới'}>
                    <div className="fgrid">
                        <Field label="Name">
                            <Text
                                value={form.name}
                                onChange={(v) => setForm({ ...form, name: v })}
                            />
                        </Field>
                        <Field label="Model (trống = inherit)">
                            <Text
                                value={form.model}
                                onChange={(v) => setForm({ ...form, model: v })}
                            />
                        </Field>
                    </div>
                    <div className="field" style={{ marginTop: 16 }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Description</span>
                        <Text
                            value={form.description}
                            onChange={(v) => setForm({ ...form, description: v })}
                        />
                    </div>
                    <div className="field" style={{ marginTop: 16 }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>
                            Tools (phân tách bằng dấu phẩy)
                        </span>
                        <Text value={form.tools} onChange={(v) => setForm({ ...form, tools: v })} />
                    </div>
                    <div className="field" style={{ marginTop: 16 }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Prompt</span>
                        <textarea
                            className="inp"
                            style={{ minHeight: 160 }}
                            value={form.prompt}
                            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button className="btn pri" onClick={save} disabled={busy || !form.name}>
                            {busy ? 'Đang lưu…' : 'Lưu'}
                        </button>
                        <button className="btn" onClick={() => setForm(null)} disabled={busy}>
                            Hủy
                        </button>
                    </div>
                </Card>
            )}
        </div>
    );
}
