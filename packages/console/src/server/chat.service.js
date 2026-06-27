import { query } from '@anthropic-ai/claude-agent-sdk';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { logger } from '@mida/logger';
import { WorkspaceManager } from '@mida/workspace';
import { configService } from '../config/index.js';
import { READ_ONLY_REGEX } from '../config/defaults.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));

const abs = (d) => (path.isAbsolute(d) ? d : path.resolve(REPO_ROOT, d));

async function resolveDirs() {
    let workDir = 'workspace';
    let sessionsDir = 'sessions';
    try {
        const ws = await configService.getWorkspaceConfig();
        workDir = ws?.workDir || workDir;
        sessionsDir = ws?.sessionsDir || sessionsDir;
    } catch {
        /* config not ready — use defaults */
    }
    return { workDir: abs(workDir), sessionsDir: abs(sessionsDir) };
}

// Same worktree machinery as the Mattermost agent, so chat sessions land in the
// shared sessions/ dir and are browsable/editable from the Files & Diff IDE.
let _manager = null;
let _baseWorkDir = null;
async function getWorkspaceManager() {
    const { workDir, sessionsDir } = await resolveDirs();
    _baseWorkDir = workDir;
    if (!_manager) _manager = new WorkspaceManager({ baseWorkDir: workDir, sessionsDir });
    return _manager;
}

// Web chat: one agent conversation per socket. Mirrors the Mattermost loop but
// approvals round-trip over the same WS instead of a Mattermost thread.
export function handleChat(ws) {
    let sessionId = '';
    let running = false;
    let chatKey = null;
    let cwd = null; // per-chat worktree dir, created lazily on first message
    const pending = new Map();
    let seq = 0;

    const buildCanUseTool = async () => {
        let readOnly = READ_ONLY_REGEX;
        let timeoutMs = 120000;
        try {
            const [g, ch] = await Promise.all([
                configService.getGuardrails(),
                configService.getChannelConfig(),
            ]);
            readOnly = g.autoApproveReadOnlyRegex || readOnly;
            timeoutMs = ch.approvalTimeoutMs || timeoutMs;
        } catch {
            /* defaults */
        }
        const RE = new RegExp(readOnly, 'i');

        return async (toolName, input, options) => {
            if (!toolName.startsWith('mcp__')) return { behavior: 'allow', updatedInput: input };
            const local = toolName.split('__').pop() ?? '';
            if (RE.test(local)) return { behavior: 'allow', updatedInput: input };

            const id = String(++seq);
            send(ws, {
                type: 'approval',
                id,
                toolName,
                input,
                description: options?.description,
            });
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    pending.delete(id);
                    resolve({ behavior: 'deny', message: 'Hết thời gian chờ duyệt' });
                }, timeoutMs);
                pending.set(id, { resolve, input, timer });
            });
        };
    };

    const run = async (text) => {
        if (running) return send(ws, { type: 'error', message: 'Agent đang bận' });
        running = true;
        try {
            // Lazily init a git worktree for this chat (same as the Mattermost flow).
            if (!cwd) {
                chatKey = `chat-${randomUUID().slice(0, 8)}`;
                try {
                    const mgr = await getWorkspaceManager();
                    cwd = await mgr.setup(chatKey);
                    send(ws, { type: 'workspace', key: chatKey, dir: cwd });
                } catch (e) {
                    logger.warn(
                        '[chat] worktree setup failed, using shared workspace: ' + e.message,
                    );
                    cwd = _baseWorkDir || (await resolveDirs()).workDir;
                    send(ws, { type: 'workspace', key: null, dir: cwd });
                }
            }

            const canUseTool = await buildCanUseTool();
            const options = await configService.buildAgentOptions({
                cwd,
                sessionId: sessionId || undefined,
                canUseTool,
            });
            const stream = query({ prompt: text, options });

            for await (const event of stream) {
                if (event.type === 'system' && event.subtype === 'init') {
                    sessionId = event.session_id;
                    send(ws, { type: 'session', sessionId });
                    continue;
                }
                if (event.type === 'result') {
                    send(ws, {
                        type: 'result',
                        cost: event.total_cost_usd,
                        turns: event.num_turns,
                        isError: event.is_error,
                    });
                    continue;
                }
                if (event.type === 'tool_use_summary') {
                    send(ws, { type: 'summary', summary: event.summary });
                    continue;
                }
                if (event.type !== 'assistant') continue;
                for (const block of event.message?.content ?? []) {
                    if (block.type === 'text') send(ws, { type: 'text', text: block.text });
                    else if (block.type === 'tool_use')
                        send(ws, { type: 'tool', name: block.name, input: block.input });
                    else if (block.type === 'thinking') send(ws, { type: 'thinking' });
                }
            }
            send(ws, { type: 'done' });
        } catch (err) {
            logger.error('[chat] ' + err.message);
            send(ws, { type: 'error', message: err.message });
        } finally {
            running = false;
        }
    };

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }
        if (msg.type === 'user' && msg.text) {
            send(ws, { type: 'ack' });
            run(msg.text);
        } else if (msg.type === 'approval_reply') {
            const p = pending.get(msg.id);
            if (p) {
                clearTimeout(p.timer);
                pending.delete(msg.id);
                p.resolve(
                    msg.allow
                        ? { behavior: 'allow', updatedInput: p.input }
                        : { behavior: 'deny', message: 'Người dùng từ chối' },
                );
            }
        }
    });

    ws.on('close', () => {
        for (const p of pending.values()) {
            clearTimeout(p.timer);
            p.resolve({ behavior: 'deny', message: 'Kết nối đóng' });
        }
        pending.clear();
    });

    send(ws, { type: 'ready' });
}
