import { useEffect, useRef, useState } from 'react';
import Empty, { ICON } from '../components/Empty.jsx';
import { WS_BASE } from '../api.js';

let uid = 0;

const EXAMPLES = [
    'Shop k-beauty mất session từ hôm qua, check giúp',
    'Heatmap trống cho luxe-store',
    'Replay render lỗi ở gadgethub',
];

export default function Chat() {
    const [blocks, setBlocks] = useState([]);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [connected, setConnected] = useState(false);
    const [worksp, setWorksp] = useState(null);
    const wsRef = useRef(null);
    const msgsRef = useRef(null);

    const add = (b) => setBlocks((bs) => [...bs, { id: ++uid, ...b }]);

    useEffect(() => {
        const ws = new WebSocket(`${WS_BASE}/ws/chat`);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onmessage = (ev) => {
            const m = JSON.parse(ev.data);
            switch (m.type) {
                case 'text':
                    add({ kind: 'text', text: m.text });
                    break;
                case 'tool':
                    add({ kind: 'tool', name: m.name, input: m.input });
                    break;
                case 'thinking':
                    add({ kind: 'thinking' });
                    break;
                case 'approval':
                    add({
                        kind: 'approval',
                        approvalId: m.id,
                        toolName: m.toolName,
                        input: m.input,
                    });
                    break;
                case 'result':
                    add({ kind: 'result', cost: m.cost, turns: m.turns });
                    break;
                case 'error':
                    add({ kind: 'error', text: m.message });
                    setBusy(false);
                    break;
                case 'workspace':
                    setWorksp({ key: m.key, dir: m.dir });
                    break;
                case 'done':
                    setBusy(false);
                    break;
                default:
                    break;
            }
        };
        return () => ws.close();
    }, []);

    useEffect(() => {
        if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }, [blocks]);

    const send = () => {
        if (!text.trim() || wsRef.current?.readyState !== 1 || busy) return;
        add({ kind: 'user', text: text.trim() });
        wsRef.current.send(JSON.stringify({ type: 'user', text: text.trim() }));
        setText('');
        setBusy(true);
    };

    const reply = (block, allow) => {
        wsRef.current?.send(
            JSON.stringify({ type: 'approval_reply', id: block.approvalId, allow }),
        );
        setBlocks((bs) =>
            bs.map((b) => (b.id === block.id ? { ...b, resolved: allow ? 'allow' : 'deny' } : b)),
        );
    };

    return (
        <div className="chat">
            {worksp && (
                <div className="chat-ws">
                    <span className={'dot ' + (worksp.key ? 'g' : 'a')} />
                    git worktree:&nbsp;<b>{worksp.key || 'shared workspace'}</b>
                </div>
            )}
            <div className="chat-msgs" ref={msgsRef}>
                {!blocks.length ? (
                    <Empty
                        tone="light"
                        iconTone="heat"
                        icon={ICON.chat}
                        title="Bắt đầu điều tra với agent"
                        hint="Tool read-only chạy tự động; tool ghi (Edit / Bash…) sẽ hỏi duyệt ngay tại đây. Mỗi cuộc chat chạy trong git worktree riêng."
                    >
                        <div className="empty-chips">
                            {EXAMPLES.map((x) => (
                                <button key={x} className="empty-chip" onClick={() => setText(x)}>
                                    {x}
                                </button>
                            ))}
                        </div>
                    </Empty>
                ) : (
                    <div className="thread">
                        {blocks.map((b) => (
                            <Block key={b.id} b={b} reply={reply} />
                        ))}
                    </div>
                )}
            </div>

            <div className="composer">
                <div className="box">
                    <textarea
                        rows={1}
                        placeholder="Nhắn cho agent… (Enter gửi, Shift+Enter xuống dòng)"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                    />
                    <button
                        className="send"
                        onClick={send}
                        disabled={busy || !connected}
                        aria-label="Gửi"
                    >
                        ↑
                    </button>
                </div>
            </div>
        </div>
    );
}

function Block({ b, reply }) {
    if (b.kind === 'user')
        return (
            <div className="m user">
                <div className="bub">{b.text}</div>
            </div>
        );
    if (b.kind === 'text')
        return (
            <div className="m">
                <div className="ava">M</div>
                <div className="body">{b.text}</div>
            </div>
        );
    if (b.kind === 'thinking')
        return (
            <div className="m">
                <div className="ava">M</div>
                <div className="body cthink">💭 đang suy luận…</div>
            </div>
        );
    if (b.kind === 'tool')
        return (
            <div className="m">
                <div className="ava">M</div>
                <div className="body">
                    <div className="ctool">
                        🔧 <b>{b.name}</b>
                        {b.input ? `\n${JSON.stringify(b.input, null, 2).slice(0, 400)}` : ''}
                    </div>
                </div>
            </div>
        );
    if (b.kind === 'approval')
        return (
            <div className="m">
                <div className="ava">M</div>
                <div className="body">
                    <div className="capprove">
                        <b>⚠️ Xác nhận thực thi · {b.toolName}</b>
                        <pre>{JSON.stringify(b.input, null, 2).slice(0, 500)}</pre>
                        {b.resolved ? (
                            <span className={'tag ' + (b.resolved === 'allow' ? 'ok' : 'crit')}>
                                {b.resolved === 'allow' ? '✓ đã cho phép' : '✕ đã từ chối'}
                            </span>
                        ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn pri sm" onClick={() => reply(b, true)}>
                                    ✓ Cho phép
                                </button>
                                <button className="btn sm" onClick={() => reply(b, false)}>
                                    ✕ Từ chối
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    if (b.kind === 'result')
        return (
            <div className="m">
                <div className="ava">M</div>
                <div className="body cresult">
                    ✓ done · 💰 ${Number(b.cost || 0).toFixed(4)} · {b.turns} turns
                </div>
            </div>
        );
    if (b.kind === 'error')
        return (
            <div className="m">
                <div className="ava">M</div>
                <div className="body" style={{ color: 'var(--crit)' }}>
                    ❌ {b.text}
                </div>
            </div>
        );
    return null;
}
