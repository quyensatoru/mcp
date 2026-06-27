import { useEffect, useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import Empty, { ICON } from '../components/Empty.jsx';
import { WS_BASE } from '../api.js';

const LANG = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
};
const langOf = (p) => LANG[p.split('.').pop()] || 'plaintext';

function TreeNode({ node, depth, childrenMap, loadDir, openFile, active }) {
    const [open, setOpen] = useState(false);
    const isDir = node.type === 'dir';
    const kids = childrenMap[node.path];

    const toggle = () => {
        if (!isDir) return openFile(node.path);
        if (!open && !kids) loadDir(node.path);
        setOpen(!open);
    };
    return (
        <>
            <button
                className={'trow' + (!isDir && active === node.path ? ' on' : '')}
                style={{ paddingLeft: 14 + depth * 14 }}
                onClick={toggle}
                title={node.path}
            >
                <span style={{ width: 10 }}>{isDir ? (open ? '▾' : '▸') : ''}</span>
                {node.name}
            </button>
            {isDir &&
                open &&
                (kids || []).map((c) => (
                    <TreeNode
                        key={c.path}
                        node={c}
                        depth={depth + 1}
                        childrenMap={childrenMap}
                        loadDir={loadDir}
                        openFile={openFile}
                        active={active}
                    />
                ))}
        </>
    );
}

export default function Files({ data, api }) {
    const [sessions, setSessions] = useState(null);
    const [session, setSession] = useState(null); // session object { session, repos: [...] }
    const [repo, setRepo] = useState(null); // active repo name within the session
    const [roots, setRoots] = useState([]);
    const [childrenMap, setChildrenMap] = useState({});
    const [tabs, setTabs] = useState([]); // [{ path, content, dirty }]
    const [active, setActive] = useState(null);
    const [git, setGit] = useState({ branch: null, files: [] });
    const [commitMsg, setCommitMsg] = useState('');
    const [termOpen, setTermOpen] = useState(true);
    const [termLines, setTermLines] = useState([]);
    const [cmd, setCmd] = useState('');
    const [repoMenu, setRepoMenu] = useState(false);
    const wsRef = useRef(null);
    const termBodyRef = useRef(null);
    const ddRef = useRef(null);

    const sname = session?.session;

    useEffect(() => {
        api.sessions()
            .then(setSessions)
            .catch(() => setSessions([]));
    }, [api]);

    const refreshGit = useCallback(() => {
        if (!sname || !repo) return;
        api.gitStatus(sname, repo)
            .then(setGit)
            .catch(() => {});
    }, [api, sname, repo]);

    // Switch the active repo within the open session: reset tree/editor, reload.
    const selectRepo = async (s, r) => {
        setRepo(r);
        setRoots([]);
        setChildrenMap({});
        setTabs([]);
        setActive(null);
        setGit({ branch: null, files: [] });
        setTermLines([]);
        if (!r) return;
        try {
            setRoots(await api.tree(s, r, ''));
            setGit(await api.gitStatus(s, r));
        } catch {
            /* repo may be empty */
        }
    };

    const openSession = (s) => {
        setSession(s);
        selectRepo(s.session, s.repos[0]?.repo || null);
    };

    const loadDir = async (dir) => {
        const kids = await api.tree(sname, repo, dir);
        setChildrenMap((m) => ({ ...m, [dir]: kids }));
    };

    const openFile = async (path) => {
        if (!tabs.find((t) => t.path === path)) {
            const { content } = await api.readFile(sname, repo, path);
            setTabs((t) => [...t, { path, content, dirty: false }]);
        }
        setActive(path);
    };

    const onEdit = (val) => {
        setTabs((t) =>
            t.map((tab) =>
                tab.path === active ? { ...tab, content: val ?? '', dirty: true } : tab,
            ),
        );
    };

    const save = async () => {
        const tab = tabs.find((t) => t.path === active);
        if (!tab) return;
        await api.writeFile(sname, repo, tab.path, tab.content);
        setTabs((t) => t.map((x) => (x.path === active ? { ...x, dirty: false } : x)));
        refreshGit();
    };

    const showDiff = async (file) => {
        setTermOpen(true);
        const { diff } = await api.gitDiff(sname, repo, file);
        setTermLines((l) => [...l, `$ git diff -- ${file}`, diff || '(no diff)']);
    };

    const commit = async () => {
        if (!commitMsg.trim()) return;
        try {
            const res = await api.gitCommit(sname, repo, commitMsg.trim());
            setTermLines((l) => [...l, `$ git commit`, res.output || 'committed']);
            setCommitMsg('');
            refreshGit();
        } catch (e) {
            alert(e.message);
        }
    };

    // terminal WS — reconnects whenever the active session/repo changes
    useEffect(() => {
        if (!sname || !repo) return;
        const ws = new WebSocket(
            `${WS_BASE}/ws/terminal?session=${encodeURIComponent(sname)}&repo=${encodeURIComponent(repo)}`,
        );
        ws.onmessage = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.type === 'cmd') setTermLines((l) => [...l, `$ ${m.data}`]);
            else if (m.type === 'out') setTermLines((l) => [...l, m.data.replace(/\n$/, '')]);
            else if (m.type === 'exit') refreshGit();
            else if (m.type === 'error') setTermLines((l) => [...l, `[error] ${m.data}`]);
        };
        wsRef.current = ws;
        return () => ws.close();
    }, [sname, repo, refreshGit]);

    useEffect(() => {
        if (termBodyRef.current) termBodyRef.current.scrollTop = termBodyRef.current.scrollHeight;
    }, [termLines]);

    // close repo dropdown on outside click
    useEffect(() => {
        if (!repoMenu) return;
        const onDoc = (e) => {
            if (ddRef.current && !ddRef.current.contains(e.target)) setRepoMenu(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [repoMenu]);

    const runCmd = () => {
        if (!cmd.trim() || wsRef.current?.readyState !== 1) return;
        wsRef.current.send(JSON.stringify({ type: 'cmd', cmd: cmd.trim() }));
        setCmd('');
    };

    const tab = tabs.find((t) => t.path === active);
    const curChanges = session?.repos.find((r) => r.repo === repo)?.changes || 0;

    if (sessions && !sessions.length) {
        return (
            <div className="ide">
                <Empty
                    tone="dark"
                    icon={ICON.folder}
                    title="Chưa có session worktree"
                    hint="Agent tạo một git worktree riêng khi xử lý thread Mattermost hoặc khi bạn chat. Khi có, chúng sẽ hiện ở đây để mở, sửa và commit như VSCode."
                />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="sess-wrap">
                <div className="sess-head">
                    <h2>Files &amp; Diff</h2>
                    <p>Chọn session để mở toàn bộ repo của nó — duyệt, sửa, xem diff và commit.</p>
                </div>
                <div className="sess-list">
                    {(sessions || []).map((s) => {
                        const total = s.repos.reduce((a, r) => a + (r.changes || 0), 0);
                        const branch = s.repos[0]?.branch;
                        return (
                            <div className="sess-card" key={s.session}>
                                <div className="sess-top">
                                    <span className="sess-ic">{ICON.folder}</span>
                                    <div style={{ minWidth: 0 }}>
                                        <div className="sess-name">{s.session}</div>
                                        <div className="sess-meta">
                                            {branch && <span>⎇ {branch}</span>}
                                            <span>{s.repos.length} repo</span>
                                            {total > 0 && (
                                                <span className="chg">{total} thay đổi</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="sp" />
                                    <button className="btn pri sm" onClick={() => openSession(s)}>
                                        Mở
                                    </button>
                                </div>
                                <div className="sess-repos">
                                    {s.repos.map((r) => (
                                        <button
                                            key={r.repo}
                                            className={'rpill' + (r.changes > 0 ? ' chg' : '')}
                                            onClick={() => {
                                                setSession(s);
                                                selectRepo(s.session, r.repo);
                                            }}
                                        >
                                            {r.repo}
                                            {r.changes > 0 && (
                                                <span className="rb">{r.changes}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="ide">
            <div className="ide-bar">
                <div className="repo-dd" ref={ddRef}>
                    <button
                        className="repo-dd-btn"
                        onClick={() => setRepoMenu((o) => !o)}
                        title="Đổi repo"
                    >
                        {ICON.folder}
                        <b>{repo}</b>
                        {curChanges > 0 && <span className="rb">{curChanges}</span>}
                        <span className="caret">▾</span>
                    </button>
                    {repoMenu && (
                        <div className="repo-dd-menu">
                            {session.repos.map((r) => (
                                <button
                                    key={r.repo}
                                    className={'repo-item' + (r.repo === repo ? ' on' : '')}
                                    onClick={() => {
                                        setRepoMenu(false);
                                        if (r.repo !== repo) selectRepo(sname, r.repo);
                                    }}
                                >
                                    {r.repo}
                                    {r.changes > 0 && <span className="rb">{r.changes}</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <span className="path">{tab ? tab.path : sname}</span>
                <div className="sp" />
                <button className="ibtn" onClick={() => setSession(null)}>
                    ↩ Sessions
                </button>
                <button className="ibtn" onClick={save} disabled={!tab?.dirty}>
                    ⟳ Save
                </button>
                <button
                    className={'ibtn' + (termOpen ? ' on' : '')}
                    onClick={() => setTermOpen((v) => !v)}
                >
                    ▤ Terminal
                </button>
            </div>

            <div className="ide-body">
                <div className="ide-col treecol">
                    <div className="tree">
                        <div className="th2">{repo}</div>
                        {roots.map((n) => (
                            <TreeNode
                                key={n.path}
                                node={n}
                                depth={0}
                                childrenMap={childrenMap}
                                loadDir={loadDir}
                                openFile={openFile}
                                active={active}
                            />
                        ))}
                    </div>
                </div>

                <div className="ide-col center">
                    <div className="etabs">
                        {tabs.map((t) => (
                            <button
                                key={t.path}
                                className={'etab' + (active === t.path ? ' on' : '')}
                                onClick={() => setActive(t.path)}
                            >
                                {t.dirty && <span className="dotm" />}
                                {t.path.split('/').pop()}
                            </button>
                        ))}
                    </div>
                    <div className="editor-wrap">
                        {tab ? (
                            <Editor
                                height="100%"
                                theme="vs-dark"
                                path={`${repo}/${tab.path}`}
                                language={langOf(tab.path)}
                                value={tab.content}
                                onChange={onEdit}
                                options={{
                                    fontSize: 13,
                                    minimap: { enabled: false },
                                    automaticLayout: true,
                                }}
                            />
                        ) : (
                            <Empty
                                tone="dark"
                                icon={ICON.file}
                                title="Chưa mở file"
                                hint="Chọn file ở cây bên trái để xem và sửa trong editor."
                            />
                        )}
                    </div>
                    <div className={'term' + (termOpen ? '' : ' hidden')}>
                        <div className="tbar">
                            <span className="tt">Terminal · {repo}</span>
                            <div style={{ flex: 1 }} />
                            <button className="ibtn" onClick={() => setTermLines([])}>
                                clear
                            </button>
                        </div>
                        <div className="tbody" ref={termBodyRef}>
                            {termLines.join('\n')}
                        </div>
                        <div className="tin">
                            <span>$</span>
                            <input
                                value={cmd}
                                placeholder="git status   ·   npm test   ·   ls"
                                onChange={(e) => setCmd(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && runCmd()}
                            />
                        </div>
                    </div>
                </div>

                <div className="ide-col git">
                    <div className="gh2">Source control · {git.files.length}</div>
                    {git.files.map((f) => (
                        <div className="gr" key={f.path}>
                            <span className={'s ' + (f.x === '?' ? 'a' : 'm')}>
                                {f.x === '?' ? 'U' : f.x.trim() || f.y.trim() || 'M'}
                            </span>
                            <button
                                className="trow"
                                style={{ padding: 0, background: 'none' }}
                                onClick={() => openFile(f.path)}
                            >
                                {f.path}
                            </button>
                            <button className="ibtn" onClick={() => showDiff(f.path)}>
                                diff
                            </button>
                        </div>
                    ))}
                    {!git.files.length && (
                        <div style={{ padding: 14, color: '#5c6480', fontSize: 12 }}>
                            Không có thay đổi.
                        </div>
                    )}
                    <div className="commit">
                        <textarea
                            rows={3}
                            placeholder="commit message…"
                            value={commitMsg}
                            onChange={(e) => setCommitMsg(e.target.value)}
                        />
                        <button
                            className="btn pri sm"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                            onClick={commit}
                            disabled={!commitMsg.trim() || !git.files.length}
                        >
                            ✓ Commit ({git.files.length})
                        </button>
                    </div>
                </div>
            </div>

            <div className="ide-status">
                <span>⎇ {git.branch || '—'}</span>
                <span>{git.files.length} thay đổi</span>
                <span>{session.repos.length} repo</span>
                <div className="sp" />
                <span>{tab ? langOf(tab.path) : ''}</span>
                <span>{data.workspace?.sessionsDir}</span>
            </div>
        </div>
    );
}
