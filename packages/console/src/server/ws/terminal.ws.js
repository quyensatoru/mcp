import { spawn } from 'node:child_process';
import { resolveRepo } from '../paths.js';

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));

// Line-oriented terminal: each {cmd} message spawns a shell in the worktree cwd
// and streams stdout/stderr back. Not a full PTY (no interactive TUIs) but enough
// for git / npm / ls. cwd is pinned to the session worktree (traversal-guarded).
export async function handleTerminal(ws, req) {
    const url = new URL(req.url, 'http://localhost');
    let cwd;
    try {
        cwd = await resolveRepo(url.searchParams.get('session'), url.searchParams.get('repo'));
    } catch (e) {
        send(ws, { type: 'error', data: e.message });
        return ws.close();
    }

    let child = null;
    send(ws, { type: 'ready', cwd });

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }
        if (msg.type === 'cmd' && msg.cmd) {
            if (child) return send(ws, { type: 'out', data: '\n[busy] lệnh trước chưa xong\n' });
            send(ws, { type: 'cmd', data: msg.cmd });
            child = spawn(msg.cmd, { cwd, shell: true });
            child.stdout.on('data', (d) => send(ws, { type: 'out', data: d.toString() }));
            child.stderr.on('data', (d) => send(ws, { type: 'out', data: d.toString() }));
            child.on('close', (code) => {
                child = null;
                send(ws, { type: 'exit', code });
            });
            child.on('error', (err) => {
                child = null;
                send(ws, { type: 'out', data: `\n[error] ${err.message}\n` });
                send(ws, { type: 'exit', code: 1 });
            });
        } else if (msg.type === 'kill' && child) {
            child.kill();
        }
    });

    ws.on('close', () => child && child.kill());
}
