import { useState } from 'react';
import { Card, Field, Text, Toggle, SaveBar, useDraft } from '../ui.jsx';

const HOOK_LABELS = {
    sessionStart: 'SessionStart',
    preToolUse: 'PreToolUse (chặn lệnh nguy hiểm)',
    postToolUse: 'PostToolUse',
    permissionRequest: 'PermissionRequest',
};

export default function Guardrails({ data, api, reload }) {
    const d = useDraft(data.guardrails);
    const [saving, setSaving] = useState(false);
    const [newPat, setNewPat] = useState('');

    const pats = d.draft.denyCommandPatterns || [];

    const save = async () => {
        setSaving(true);
        try {
            const next = await api.patch('guardrails', {
                denyCommandPatterns: d.draft.denyCommandPatterns,
                autoApproveReadOnlyRegex: d.draft.autoApproveReadOnlyRegex,
                hooks: d.draft.hooks,
            });
            d.commit(next);
            await reload();
        } catch (e) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="wrap">
            <div className="phead">
                <div>
                    <h2>Guardrails</h2>
                    <p>
                        Chặn lệnh nguy hiểm (PreToolUse hook), auto-approve tool read-only, bật/tắt
                        hook.
                    </p>
                </div>
            </div>

            <Card title="Chặn lệnh (deny patterns)" desc="Regex khớp lệnh Bash sẽ bị từ chối">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {pats.map((p) => (
                        <span className="chip deny" key={p}>
                            {p}
                            <button
                                className="x"
                                onClick={() =>
                                    d.set(
                                        'denyCommandPatterns',
                                        pats.filter((x) => x !== p),
                                    )
                                }
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                    <input
                        className="inp"
                        style={{ width: 220 }}
                        placeholder="rm\s+-rf"
                        value={newPat}
                        onChange={(e) => setNewPat(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newPat.trim()) {
                                d.set('denyCommandPatterns', [...pats, newPat.trim()]);
                                setNewPat('');
                            }
                        }}
                    />
                </div>
            </Card>

            <Card
                title="Auto-approve read-only"
                desc="Regex khớp tên tool MCP sẽ được duyệt tự động"
            >
                <Field label="Read-only regex">
                    <Text
                        value={d.draft.autoApproveReadOnlyRegex}
                        onChange={(v) => d.set('autoApproveReadOnlyRegex', v)}
                    />
                </Field>
            </Card>

            <Card title="Hooks">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.keys(HOOK_LABELS).map((k) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Toggle
                                on={!!d.draft.hooks?.[k]}
                                onChange={(v) => d.set('hooks', { ...d.draft.hooks, [k]: v })}
                            />
                            <span>{HOOK_LABELS[k]}</span>
                        </div>
                    ))}
                </div>
            </Card>

            <SaveBar dirty={d.dirty} saving={saving} onSave={save} onReset={d.reset} />
        </div>
    );
}
