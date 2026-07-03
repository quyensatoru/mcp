import { useEffect, useRef, useState, useCallback } from 'react';
import Empty, { ICON } from '../components/Empty.jsx';
import Markdown from '../components/Markdown.jsx';
import { WS_BASE, api } from '../api.js';

let uid = 0;

const EXAMPLES = [
    'Shop k-beauty mất session từ hôm qua, check giúp',
    'Heatmap trống cho luxe-store',
    'Replay render lỗi ở gadgethub',
];

function fmtDur(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMins = Math.floor((now - d) / 60000);
    if (diffMins < 1) return 'vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h trước`;
    return d.toLocaleDateString('vi-VN');
}

function addTimelineItem(subagent, item) {
    return { ...subagent, timeline: [...subagent.timeline, item] };
}

export default function Chat({ onNavigateToWorktree }) {
    const [blocks, setBlocks] = useState([]);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [connected, setConnected] = useState(false);
    const [worksp, setWorksp] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [subagents, setSubagents] = useState([]);
    const [saOpen, setSaOpen] = useState(false);
    const [saFilter, setSaFilter] = useState('all');
    const [saAutoScroll, setSaAutoScroll] = useState(true);
    const [loopOpen, setLoopOpen] = useState(false);
    const [loopStatus, setLoopStatus] = useState(null);
    const [loopIterations, setLoopIterations] = useState([]);
    const [, setTick] = useState(0);
    const wsRef = useRef(null);
    const msgsRef = useRef(null);
    const taRef = useRef(null);
    const saRefs = useRef({});

    const resizeTa = (el) => {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 112) + 'px';
    };

    const add = (b) => setBlocks((bs) => [...bs, { id: ++uid, ...b }]);
    const addToIteration = (index, b) =>
        setLoopIterations((list) =>
            list.map((it) =>
                it.index === index ? { ...it, blocks: [...it.blocks, { id: ++uid, ...b }] } : it,
            ),
        );

    const refreshSessions = useCallback(() => {
        setLoadingSessions(true);
        api.chatSessions()
            .then(setSessions)
            .catch(() => {})
            .finally(() => setLoadingSessions(false));
    }, []);

    useEffect(() => {
        refreshSessions();
    }, [refreshSessions]);

    useEffect(() => {
        const ws = new WebSocket(`${WS_BASE}/ws/chat`);
        wsRef.current = ws;
        ws.onopen = () => {
            setConnected(true);
        };
        ws.onerror = (e) => {
            console.error('ERROR', e);
        };
        ws.onclose = (e) => {
            setConnected(false);
        };
        ws.onmessage = (ev) => {
            const m = JSON.parse(ev.data);
            switch (m.type) {
                case 'text':
                    if (m.iteration != null)
                        addToIteration(m.iteration, { kind: 'text', text: m.text });
                    else add({ kind: 'text', text: m.text });
                    break;
                case 'tool':
                    if (m.iteration != null)
                        addToIteration(m.iteration, { kind: 'tool', name: m.name, input: m.input });
                    else add({ kind: 'tool', name: m.name, input: m.input });
                    break;
                case 'thinking':
                    if (m.iteration != null) addToIteration(m.iteration, { kind: 'thinking' });
                    else add({ kind: 'thinking' });
                    break;
                case 'image':
                    if (m.iteration != null)
                        addToIteration(m.iteration, {
                            kind: 'image',
                            mediaType: m.mediaType,
                            data: m.data,
                        });
                    else add({ kind: 'image', mediaType: m.mediaType, data: m.data });
                    break;
                case 'loop_start':
                    setLoopOpen(true);
                    setLoopStatus('running');
                    setLoopIterations([]);
                    break;
                case 'loop_iteration_start':
                    setLoopIterations((list) => [
                        ...list,
                        { index: m.index, status: 'running', blocks: [], startedAt: Date.now() },
                    ]);
                    break;
                case 'loop_iteration_end':
                    setLoopIterations((list) =>
                        list.map((it) =>
                            it.index === m.index
                                ? {
                                      ...it,
                                      status: m.status,
                                      costUsd: m.costUsd,
                                      turns: m.turns,
                                      summary: m.summary,
                                  }
                                : it,
                        ),
                    );
                    break;
                case 'loop_done':
                    setLoopStatus(m.status);
                    setBusy(false);
                    refreshSessions();
                    break;
                case 'subagent':
                    setSaOpen(true);
                    setSubagents((list) => {
                        if (m.phase === 'start') {
                            if (list.some((s) => s.id === m.agentId)) return list;
                            return [
                                {
                                    id: m.agentId,
                                    type: m.agentType,
                                    description: m.description,
                                    status: 'running',
                                    timeline: [],
                                    text: '',
                                    startedAt: Date.now(),
                                    open: true,
                                },
                                ...list,
                            ];
                        }
                        return list.map((s) => {
                            if (s.id !== m.agentId) return s;
                            switch (m.phase) {
                                case 'tool':
                                    return addTimelineItem(s, {
                                        kind: 'tool',
                                        name: m.toolName,
                                        input: m.toolInput,
                                    });
                                case 'text':
                                    return addTimelineItem(s, { kind: 'text', text: m.text });
                                case 'thinking':
                                    return addTimelineItem(s, { kind: 'thinking' });
                                case 'image':
                                    return addTimelineItem(s, {
                                        kind: 'image',
                                        mediaType: m.mediaType,
                                        data: m.data,
                                    });
                                case 'stop':
                                    return { ...s, status: 'done', text: m.text || '' };
                                default:
                                    return s;
                            }
                        });
                    });
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
                case 'session':
                    setActiveSessionId(m.sessionId);
                    // Refresh sidebar after a new session is created
                    setTimeout(refreshSessions, 300);
                    break;
                case 'history':
                    // Restore blocks from session history
                    setBlocks((m.messages ?? []).map((msg) => ({ id: ++uid, ...msg })));
                    setSubagents([]);
                    break;
                case 'done':
                    setBusy(false);
                    refreshSessions();
                    break;
                default:
                    break;
            }
        };
        return () => ws.close();
    }, [refreshSessions]);

    useEffect(() => {
        if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }, [blocks]);

    useEffect(() => {
        if (!subagents.some((s) => s.status === 'running')) return;
        const t = setInterval(() => setTick((x) => x + 1), 1000);
        return () => clearInterval(t);
    }, [subagents]);

    useEffect(() => {
        if (!saAutoScroll) return;
        for (const s of subagents) {
            const el = saRefs.current[s.id];
            if (el && s.open) el.scrollTop = el.scrollHeight;
        }
    }, [subagents, saAutoScroll]);

    const toggleSaCard = (id) =>
        setSubagents((list) => list.map((s) => (s.id === id ? { ...s, open: !s.open } : s)));
    const clearFinishedSa = () => setSubagents((list) => list.filter((s) => s.status !== 'done'));
    const runningSaCount = subagents.filter((s) => s.status === 'running').length;

    const submit = (type) => {
        if (!text.trim() || wsRef.current?.readyState !== 1 || busy) return;
        add({ kind: 'user', text: text.trim() });
        wsRef.current.send(JSON.stringify({ type, text: text.trim() }));
        setText('');
        if (taRef.current) {
            taRef.current.style.height = 'auto';
        }
        setBusy(true);
    };
    const send = () => submit('user');
    const sendLoop = () => submit('loop_start');
    const stopLoop = () => wsRef.current?.send(JSON.stringify({ type: 'loop_stop' }));

    const reply = (block, allow) => {
        wsRef.current?.send(
            JSON.stringify({ type: 'approval_reply', id: block.approvalId, allow }),
        );
        setBlocks((bs) =>
            bs.map((b) => (b.id === block.id ? { ...b, resolved: allow ? 'allow' : 'deny' } : b)),
        );
    };

    const newChat = () => {
        setBlocks([]);
        setWorksp(null);
        setActiveSessionId(null);
        setSubagents([]);
        wsRef.current?.send(JSON.stringify({ type: 'new_chat' }));
    };

    const resumeSession = (session) => {
        if (busy) return;
        if (session.id === activeSessionId) return;
        setBlocks([]);
        // Optimistic update từ session data để chat-ws hiển thị đúng ngay lập tức
        setWorksp(
            session.worktreeKey ? { key: session.worktreeKey, dir: session.cwd || '' } : null,
        );
        setActiveSessionId(session.id);
        wsRef.current?.send(JSON.stringify({ type: 'resume', sessionId: session.id }));
    };

    return (
        <div className="chat-layout">
            {/* ── Sidebar ── */}
            <div className={'chat-sidebar' + (sidebarOpen ? '' : ' collapsed')}>
                <div className="chat-sb-header">
                    {sidebarOpen && (
                        <button className="btn pri sm w-full" onClick={newChat} disabled={busy}>
                            + New chat
                        </button>
                    )}
                    <button
                        className="chat-sb-toggle"
                        onClick={() => setSidebarOpen((o) => !o)}
                        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        {sidebarOpen ? (
                            <svg
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                width="14"
                                height="14"
                            >
                                <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
                                <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" />
                                <path d="M9.5 6.5L7.5 8l2 1.5" />
                            </svg>
                        ) : (
                            <svg
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                width="14"
                                height="14"
                            >
                                <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
                                <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" />
                                <path d="M7.5 6.5L9.5 8l-2 1.5" />
                            </svg>
                        )}
                    </button>
                </div>
                {sidebarOpen && (
                    <div className="chat-sb-list">
                        {loadingSessions && !sessions.length ? (
                            <div className="chat-sb-empty">Loading…</div>
                        ) : !sessions.length ? (
                            <div className="chat-sb-empty">No conversations yet</div>
                        ) : (
                            sessions.map((s) => (
                                <div
                                    key={s.id}
                                    className={
                                        'chat-sess-item' + (s.id === activeSessionId ? ' on' : '')
                                    }
                                >
                                    <button
                                        className="chat-sess-body"
                                        onClick={() => resumeSession(s)}
                                        disabled={busy && s.id !== activeSessionId}
                                    >
                                        <div className="chat-sess-title">
                                            {s.title || (
                                                <span className="chat-sess-notitle">
                                                    {s.id.slice(0, 12)}…
                                                </span>
                                            )}
                                        </div>
                                        <div className="chat-sess-meta">
                                            <span>{fmtTime(s.lastModified ?? s.createdAt)}</span>
                                            {s.worktreeKey && (
                                                <span
                                                    className="chat-sess-branch"
                                                    title={s.worktreeKey}
                                                >
                                                    {s.worktreeKey}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    {s.worktreeKey && onNavigateToWorktree && (
                                        <button
                                            className="chat-sess-files-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onNavigateToWorktree(s.worktreeKey);
                                            }}
                                            title="Open Files & Diff"
                                        >
                                            <svg
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                width="13"
                                                height="13"
                                            >
                                                <path d="M5 2v5.5a2.5 2.5 0 0 0 5 0V6M11 2v2" />
                                                <circle cx="11" cy="13" r="1.5" />
                                                <circle cx="5" cy="13" r="1.5" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* ── Main chat area ── */}
            <div className="chat-main">
                <div className="chat-toolbar">
                    <span className="sp" />
                    <button
                        className={'sa-toggle' + (loopOpen ? ' active' : '')}
                        onClick={() => setLoopOpen((o) => !o)}
                    >
                        🔁 Loop
                        <span className={'sa-cnt' + (loopIterations.length ? '' : ' zero')}>
                            {loopIterations.length}
                        </span>
                    </button>
                    <button
                        className={'sa-toggle' + (saOpen ? ' active' : '')}
                        onClick={() => setSaOpen((o) => !o)}
                    >
                        🧵 Subagents
                        <span className={'sa-cnt' + (runningSaCount ? '' : ' zero')}>
                            {runningSaCount}
                        </span>
                    </button>
                </div>
                {worksp && (
                    <div className="chat-ws">
                        <span className={'dot ' + (worksp.key ? 'g' : 'a')} />
                        git worktree:&nbsp;
                        {worksp.key && onNavigateToWorktree ? (
                            <button
                                className="chat-ws-link"
                                onClick={() => onNavigateToWorktree(worksp.key)}
                                title="Open Files & Diff"
                            >
                                {worksp.key}
                                <span className="chat-ws-arrow">→ Files</span>
                            </button>
                        ) : (
                            <b>{worksp.key || 'shared workspace'}</b>
                        )}
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
                                    <button
                                        key={x}
                                        className="empty-chip"
                                        onClick={() => setText(x)}
                                    >
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
                            ref={taRef}
                            rows={1}
                            placeholder="Nhắn cho agent… (Enter gửi, Shift+Enter xuống dòng)"
                            value={text}
                            onChange={(e) => {
                                setText(e.target.value);
                                resizeTa(e.target);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    send();
                                }
                            }}
                        />
                        <button
                            className="send"
                            onClick={sendLoop}
                            disabled={busy || !connected}
                            title="Gửi dạng Loop Engineer — tự lặp plan/implement/verify đến khi xong"
                            aria-label="Gửi dạng Loop"
                        >
                            🔁
                        </button>
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

            <LoopPanel
                open={loopOpen}
                onClose={() => setLoopOpen(false)}
                status={loopStatus}
                iterations={loopIterations}
                onStop={stopLoop}
            />

            <SubagentPanel
                open={saOpen}
                onClose={() => setSaOpen(false)}
                subagents={subagents}
                filter={saFilter}
                setFilter={setSaFilter}
                onToggleCard={toggleSaCard}
                autoScroll={saAutoScroll}
                setAutoScroll={setSaAutoScroll}
                onClear={clearFinishedSa}
                tlRefs={saRefs}
            />
        </div>
    );
}

const LOOP_STATUS_LABEL = {
    running: 'đang chạy',
    done: 'hoàn tất',
    stopped: 'đã dừng',
    max_reached: 'hết số vòng',
    error: 'lỗi',
};
const loopDotClass = (status) =>
    status === 'running' ? 'b pulse' : status === 'error' ? 'r' : status === 'done' ? 'g' : 'a';

function LoopPanel({ open, onClose, status, iterations, onStop }) {
    return (
        <div className={'sa-panel' + (open ? ' open' : '')}>
            <div className="sa-panel-inner">
                <div className="sa-head">
                    <div className="sa-head-row">
                        <h3>Loop Engineer</h3>
                        <span className="sa-live">
                            <span className={'dot ' + loopDotClass(status)} />
                            {status ? LOOP_STATUS_LABEL[status] || status : 'chưa chạy'}
                        </span>
                        <span className="sp" />
                        {status === 'running' && (
                            <button className="btn sm" onClick={onStop}>
                                Dừng
                            </button>
                        )}
                        <button className="sa-close" onClick={onClose} title="Đóng panel">
                            ✕
                        </button>
                    </div>
                    <div className="sa-head-sub" />
                </div>
                <div className="sa-list">
                    {!iterations.length ? (
                        <div className="sa-empty">Chưa có iteration nào.</div>
                    ) : (
                        iterations.map((it) => <LoopCard key={it.index} it={it} />)
                    )}
                </div>
            </div>
        </div>
    );
}

function LoopCard({ it }) {
    const [open, setOpen] = useState(it.status === 'running');
    return (
        <div className={'sa-card ' + it.status + (open ? ' open' : '')}>
            <div className="sa-card-head" onClick={() => setOpen((o) => !o)}>
                <span className={'dot ' + loopDotClass(it.status)} />
                <span className="sa-card-name">Iteration {it.index}</span>
                <span className="sp" />
                <span className="sa-card-time">{it.turns ? `${it.turns} turns` : ''}</span>
                <svg
                    className="sa-chev"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                >
                    <path d="M6 3l5 5-5 5" />
                </svg>
            </div>
            <div className="sa-card-body">
                <div className="sa-timeline">
                    {it.blocks.map((b) =>
                        b.kind === 'image' ? (
                            <img
                                key={b.id}
                                className="chat-img"
                                src={`data:${b.mediaType};base64,${b.data}`}
                                alt=""
                            />
                        ) : (
                            <div className="ctool" key={b.id}>
                                {b.kind === 'tool'
                                    ? `🔧 ${b.name}`
                                    : b.kind === 'thinking'
                                      ? '💭 đang suy luận…'
                                      : b.text}
                            </div>
                        ),
                    )}
                    {it.summary && <div className="sa-final-text">{it.summary}</div>}
                </div>
            </div>
        </div>
    );
}

function SubagentPanel({
    open,
    onClose,
    subagents,
    filter,
    setFilter,
    onToggleCard,
    autoScroll,
    setAutoScroll,
    onClear,
    tlRefs,
}) {
    const items = subagents.filter((s) => filter === 'all' || s.status === filter);
    const running = subagents.filter((s) => s.status === 'running').length;
    return (
        <div className={'sa-panel' + (open ? ' open' : '')}>
            <div className="sa-panel-inner">
                <div className="sa-head">
                    <div className="sa-head-row">
                        <h3>Subagent Activity</h3>
                        <span className="sa-live">
                            <span className={'dot ' + (running ? 'b pulse' : 'g')} />
                            {running ? `${running} đang chạy` : 'Không có tiến trình'}
                        </span>
                        <span className="sp" />
                        <button className="sa-close" onClick={onClose} title="Đóng panel">
                            ✕
                        </button>
                    </div>
                    <div className="sa-head-sub">
                        <div className="seg">
                            {['all', 'running', 'done'].map((f) => (
                                <button
                                    key={f}
                                    className={filter === f ? 'on' : ''}
                                    onClick={() => setFilter(f)}
                                >
                                    {f === 'all'
                                        ? 'Tất cả'
                                        : f === 'running'
                                          ? 'Đang chạy'
                                          : 'Hoàn tất'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="sa-list">
                    {!items.length ? (
                        <div className="sa-empty">Chưa có subagent nào được khởi chạy.</div>
                    ) : (
                        items.map((s) => (
                            <SubagentCard
                                key={s.id}
                                s={s}
                                onToggle={() => onToggleCard(s.id)}
                                tlRef={(el) => {
                                    tlRefs.current[s.id] = el;
                                }}
                            />
                        ))
                    )}
                </div>
                <div className="sa-foot">
                    <div className="sa-autoscroll">
                        <button
                            className={'tog' + (autoScroll ? ' on' : '')}
                            onClick={() => setAutoScroll((a) => !a)}
                        />
                        Tự động cuộn
                    </div>
                    <button className="btn sm" onClick={onClear}>
                        Xoá đã xong
                    </button>
                </div>
            </div>
        </div>
    );
}

function SubagentTimelineItem({ item }) {
    switch (item.kind) {
        case 'tool':
            return (
                <div className="ctool">
                    🔧 <b>{item.name}</b>
                    {item.input ? `\n${JSON.stringify(item.input, null, 2).slice(0, 300)}` : ''}
                </div>
            );
        case 'text':
            return <div className="sa-final-text">{item.text}</div>;
        case 'thinking':
            return <div className="cthink">💭 đang suy luận…</div>;
        case 'image':
            return (
                <img
                    className="chat-img"
                    src={`data:${item.mediaType};base64,${item.data}`}
                    alt=""
                />
            );
        default:
            return null;
    }
}

function SubagentCard({ s, onToggle, tlRef }) {
    const toolCount = s.timeline.filter((item) => item.kind === 'tool').length;
    return (
        <div className={'sa-card ' + s.status + (s.open ? ' open' : '')}>
            <div className="sa-card-head" onClick={onToggle}>
                <span className={'dot ' + (s.status === 'running' ? 'b pulse' : 'g')} />
                <span className="sa-card-name" title={s.description || undefined}>
                    {s.type}
                </span>
                <span className="sp" />
                <span className="sa-card-time">{fmtDur(Date.now() - s.startedAt)}</span>
                <svg
                    className="sa-chev"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                >
                    <path d="M6 3l5 5-5 5" />
                </svg>
            </div>
            <div className="sa-card-meta">
                <span className="chip">{toolCount} tool calls</span>
            </div>
            <div className="sa-card-body">
                <div className="sa-timeline" ref={tlRef}>
                    {s.timeline.map((item, i) => (
                        <SubagentTimelineItem key={i} item={item} />
                    ))}
                    {s.status === 'done' && s.text && <div className="sa-final-text">{s.text}</div>}
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
                <div className="body">
                    <Markdown text={b.text} />
                </div>
            </div>
        );
    if (b.kind === 'thinking')
        return (
            <div className="m">
                <div className="ava">M</div>
                <div className="body cthink">💭 đang suy luận…</div>
            </div>
        );
    if (b.kind === 'image')
        return (
            <div className="m">
                <div className="ava">M</div>
                <div className="body">
                    <img className="chat-img" src={`data:${b.mediaType};base64,${b.data}`} alt="" />
                </div>
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
