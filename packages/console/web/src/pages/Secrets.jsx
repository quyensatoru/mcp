import { useState } from 'react';
import { Card } from '../ui.jsx';
import Empty, { ICON } from '../components/Empty.jsx';

function SecretRow({ s, api, reload }) {
    const [val, setVal] = useState('');
    const [busy, setBusy] = useState(false);

    const set = async () => {
        if (!val) return;
        setBusy(true);
        try {
            await api.setSecret(s.key, val);
            setVal('');
            await reload();
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };
    const del = async () => {
        if (!confirm(`Xóa secret "${s.key}"?`)) return;
        await api.delSecret(s.key);
        await reload();
    };

    return (
        <tr>
            <td className="mono">
                <b>{s.key}</b>
            </td>
            <td>
                <span className={'tag ' + (s.encrypted ? 'ok' : 'warn')}>
                    {s.encrypted ? '🔒 encrypted' : 'plaintext'}
                </span>
            </td>
            <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.updatedBy || '—'}</td>
            <td>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <input
                        className="inp"
                        type="password"
                        style={{ width: 200 }}
                        placeholder="giá trị mới…"
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                    />
                    <button className="btn sm" onClick={set} disabled={busy || !val}>
                        Cập nhật
                    </button>
                    <button className="btn sm danger" onClick={del}>
                        Xóa
                    </button>
                </div>
            </td>
        </tr>
    );
}

export default function Secrets({ data, api, reload }) {
    const [nk, setNk] = useState('');
    const [nv, setNv] = useState('');
    const [busy, setBusy] = useState(false);

    const add = async () => {
        if (!nk.trim() || !nv) return;
        setBusy(true);
        try {
            await api.setSecret(nk.trim(), nv);
            setNk('');
            setNv('');
            await reload();
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="wrap">
            <div className="phead">
                <div>
                    <h2>Secrets</h2>
                    <p>
                        Vault mã hóa (AES-256-GCM khi có CONSOLE_MASTER_KEY). Giá trị chỉ ghi, không
                        đọc lại.
                    </p>
                </div>
            </div>

            {!data.secrets.length ? (
                <Empty
                    inline
                    icon={ICON.lock}
                    title="Vault trống"
                    hint="Thêm secret bên dưới — sẽ được mã hóa nếu CONSOLE_MASTER_KEY được set, ngược lại lưu plaintext."
                />
            ) : (
                <Card>
                    <div style={{ margin: '-18px' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Trạng thái</th>
                                    <th>Cập nhật bởi</th>
                                    <th style={{ textAlign: 'right' }}>Đặt giá trị</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.secrets.map((s) => (
                                    <SecretRow key={s.key} s={s} api={api} reload={reload} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Card title="Thêm secret">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                        className="inp"
                        style={{ width: 240 }}
                        placeholder="KEY_NAME"
                        value={nk}
                        onChange={(e) => setNk(e.target.value)}
                    />
                    <input
                        className="inp"
                        type="password"
                        style={{ width: 240 }}
                        placeholder="giá trị"
                        value={nv}
                        onChange={(e) => setNv(e.target.value)}
                    />
                    <button className="btn pri" onClick={add} disabled={busy || !nk.trim() || !nv}>
                        Thêm
                    </button>
                </div>
            </Card>
        </div>
    );
}
