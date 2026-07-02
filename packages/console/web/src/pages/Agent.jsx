import { useState } from 'react';
import { Card, Field, Text, Num, Seg, SaveBar, useDraft } from '../ui.jsx';

export default function Agent({ data, api, reload }) {
    const d = useDraft(data.agent);
    const [saving, setSaving] = useState(false);
    const [newTool, setNewTool] = useState('');

    const save = async () => {
        setSaving(true);
        try {
            const next = await api.patch('agent', {
                model: d.draft.model,
                maxTurns: d.draft.maxTurns,
                effort: d.draft.effort,
                permissionMode: d.draft.permissionMode,
                disallowedTools: d.draft.disallowedTools,
                allowedTools: d.draft.allowedTools,
                systemPromptAppend: d.draft.systemPromptAppend,
            });
            d.commit(next);
            await reload();
        } catch (e) {
            alert('Lưu lỗi: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const tools = d.draft.disallowedTools || [];
    const addTool = () => {
        const t = newTool.trim();
        if (t && !tools.includes(t)) d.set('disallowedTools', [...tools, t]);
        setNewTool('');
    };

    return (
        <div className="wrap">
            <div className="phead">
                <div>
                    <h2>Agent</h2>
                    <p>
                        Runtime &amp; system prompt — áp dụng cho mọi session mới (hot-reload từ
                        DB).
                    </p>
                </div>
            </div>

            <Card title="Runtime">
                <div className="fgrid">
                    <Field label="Model" hint="Anthropic model ID dùng cho query()">
                        <Text value={d.draft.model} onChange={(v) => d.set('model', v)} />
                    </Field>
                    <Field label="Max turns" hint="Số lượt tối đa mỗi session">
                        <Num value={d.draft.maxTurns} onChange={(v) => d.set('maxTurns', v)} />
                    </Field>
                    <Field label="Effort">
                        <Seg
                            options={['low', 'medium', 'high', 'xhigh']}
                            value={d.draft.effort}
                            onChange={(v) => d.set('effort', v)}
                        />
                    </Field>
                    <Field label="Permission mode">
                        <Seg
                            options={['default', 'acceptEdits', 'plan', 'bypassPermissions']}
                            value={d.draft.permissionMode}
                            onChange={(v) => d.set('permissionMode', v)}
                        />
                    </Field>
                </div>

                <div className="field" style={{ marginTop: 18 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Disallowed tools</span>
                    <div
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
                    >
                        {tools.map((t) => (
                            <span className="chip deny" key={t}>
                                {t}
                                <button
                                    className="x"
                                    onClick={() =>
                                        d.set(
                                            'disallowedTools',
                                            tools.filter((x) => x !== t),
                                        )
                                    }
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                        <input
                            className="inp"
                            style={{ width: 240 }}
                            placeholder="mcp__server__action_*"
                            value={newTool}
                            onChange={(e) => setNewTool(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addTool()}
                        />
                        <button className="btn sm" onClick={addTool}>
                            + thêm
                        </button>
                    </div>
                </div>
            </Card>

            <Card title="System prompt" desc="append vào preset claude_code">
                <textarea
                    className="inp"
                    style={{ minHeight: 320, fontSize: 12.5 }}
                    value={d.draft.systemPromptAppend}
                    onChange={(e) => d.set('systemPromptAppend', e.target.value)}
                />
            </Card>

            <SaveBar dirty={d.dirty} saving={saving} onSave={save} onReset={d.reset} />
        </div>
    );
}
