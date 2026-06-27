import { useState } from 'react';
import { Card, Field, Text, Num, SaveBar, useDraft } from '../ui.jsx';

export default function Mattermost({ data, api, reload }) {
    const d = useDraft({
        ...data.channel,
        _channelIdsText: (data.channel.channelIds || []).join(', '),
    });
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            const channelIds = d.draft._channelIdsText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            const next = await api.patch('channel', {
                channelIds,
                botMention: d.draft.botMention,
                loadingGif: d.draft.loadingGif,
                streamFlushMs: d.draft.streamFlushMs,
                approvalTimeoutMs: d.draft.approvalTimeoutMs,
                yesRegex: d.draft.yesRegex,
            });
            d.commit({ ...next, _channelIdsText: (next.channelIds || []).join(', ') });
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
                    <h2>Mattermost</h2>
                    <p>Channel lắng nghe, bot mention, và hành vi luồng duyệt tool.</p>
                </div>
            </div>

            <Card title="Channel">
                <Field label="Channel IDs" hint="Phân tách bằng dấu phẩy">
                    <Text
                        value={d.draft._channelIdsText}
                        onChange={(v) => d.set('_channelIdsText', v)}
                    />
                </Field>
                <div className="fgrid" style={{ marginTop: 16 }}>
                    <Field label="Bot mention">
                        <Text value={d.draft.botMention} onChange={(v) => d.set('botMention', v)} />
                    </Field>
                    <Field label="Loading GIF URL">
                        <Text value={d.draft.loadingGif} onChange={(v) => d.set('loadingGif', v)} />
                    </Field>
                </div>
            </Card>

            <Card title="Luồng duyệt">
                <div className="fgrid">
                    <Field label="Stream flush (ms)" hint="Tần suất cập nhật post">
                        <Num
                            value={d.draft.streamFlushMs}
                            onChange={(v) => d.set('streamFlushMs', v)}
                        />
                    </Field>
                    <Field label="Approval timeout (ms)" hint="Tự từ chối nếu không có reply">
                        <Num
                            value={d.draft.approvalTimeoutMs}
                            onChange={(v) => d.set('approvalTimeoutMs', v)}
                        />
                    </Field>
                    <Field label="Yes regex" hint="Khớp reply cho phép">
                        <Text value={d.draft.yesRegex} onChange={(v) => d.set('yesRegex', v)} />
                    </Field>
                </div>
            </Card>

            <SaveBar dirty={d.dirty} saving={saving} onSave={save} onReset={d.reset} />
        </div>
    );
}
