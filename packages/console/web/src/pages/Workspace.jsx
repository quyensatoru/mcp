import { useState } from 'react';
import { Card, Field, Text, Num, SaveBar, useDraft } from '../ui.jsx';

export default function Workspace({ data, api, reload }) {
    const d = useDraft(data.workspace);
    const [saving, setSaving] = useState(false);
    const rules = d.draft.branchRules || [];

    const save = async () => {
        setSaving(true);
        try {
            const next = await api.patch('workspace', {
                workDir: d.draft.workDir,
                sessionsDir: d.draft.sessionsDir,
                cleanupDays: d.draft.cleanupDays,
                worktreeBranchPrefix: d.draft.worktreeBranchPrefix,
                branchRules: rules,
                gitlab: d.draft.gitlab,
            });
            d.commit(next);
            await reload();
        } catch (e) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    const setRule = (i, k, v) => {
        const next = rules.map((r, j) => (j === i ? { ...r, [k]: v } : r));
        d.set('branchRules', next);
    };

    return (
        <div className="wrap">
            <div className="phead">
                <div>
                    <h2>Workspace</h2>
                    <p>Dọn dẹp worktree, quy tắc đặt tên branch, và GitLab sync.</p>
                </div>
            </div>

            <div className="note">
                <span>
                    <b>workDir</b> / <b>sessionsDir</b> là cấp hạ tầng — agent đọc từ env khi khởi
                    động. Đổi ở đây để lưu/hiển thị; cần restart agent để áp dụng đường dẫn mới.
                </span>
            </div>

            <Card title="Đường dẫn & cleanup">
                <div className="fgrid">
                    <Field label="Work dir">
                        <Text value={d.draft.workDir} onChange={(v) => d.set('workDir', v)} />
                    </Field>
                    <Field label="Sessions dir">
                        <Text
                            value={d.draft.sessionsDir}
                            onChange={(v) => d.set('sessionsDir', v)}
                        />
                    </Field>
                    <Field label="Cleanup (ngày)" hint="Xóa session worktree cũ hơn">
                        <Num
                            value={d.draft.cleanupDays}
                            onChange={(v) => d.set('cleanupDays', v)}
                        />
                    </Field>
                    <Field label="Worktree branch prefix">
                        <Text
                            value={d.draft.worktreeBranchPrefix}
                            onChange={(v) => d.set('worktreeBranchPrefix', v)}
                        />
                    </Field>
                </div>
            </Card>

            <Card
                title="Branch rules"
                actions={
                    <button
                        className="btn sm"
                        onClick={() => d.set('branchRules', [...rules, { type: '', pattern: '' }])}
                    >
                        + Rule
                    </button>
                }
            >
                {!rules.length && <div style={{ color: 'var(--muted)' }}>Chưa có rule.</div>}
                {rules.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <input
                            className="inp"
                            style={{ width: 140 }}
                            placeholder="type (bug)"
                            value={r.type}
                            onChange={(e) => setRule(i, 'type', e.target.value)}
                        />
                        <input
                            className="inp"
                            placeholder="bugfixsupport/{domain}"
                            value={r.pattern}
                            onChange={(e) => setRule(i, 'pattern', e.target.value)}
                        />
                        <button
                            className="btn sm danger"
                            onClick={() =>
                                d.set(
                                    'branchRules',
                                    rules.filter((_, j) => j !== i),
                                )
                            }
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </Card>

            <Card title="GitLab sync">
                <div className="fgrid">
                    <Field label="GitLab URL">
                        <Text
                            value={d.draft.gitlab?.url}
                            onChange={(v) => d.set('gitlab', { ...d.draft.gitlab, url: v })}
                        />
                    </Field>
                    <Field label="Group / Project ID">
                        <Text
                            value={d.draft.gitlab?.projectId}
                            onChange={(v) => d.set('gitlab', { ...d.draft.gitlab, projectId: v })}
                        />
                    </Field>
                </div>
            </Card>

            <SaveBar dirty={d.dirty} saving={saving} onSave={save} onReset={d.reset} />
        </div>
    );
}
