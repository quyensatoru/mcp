import {
    listSessions,
    getSessionMessages,
    getSessionInfo,
    query,
} from '@anthropic-ai/claude-agent-sdk';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { logger } from '@mida/logger';
import { WorkspaceManager } from '@mida/workspace';
import { configService } from '../../config/index.js';
import { READ_ONLY_REGEX } from '../../config/defaults.js';

let _manager = null;
let _baseWorkDir = null;

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
    } catch (e) {
        logger.error(e);
    }
    return { workDir: abs(workDir), sessionsDir: abs(sessionsDir) };
}

async function getWorkspaceManager() {
    const { workDir: baseWorkDir, sessionsDir } = await resolveDirs();

    _baseWorkDir = baseWorkDir;

    if (!_manager) {
        _manager = new WorkspaceManager({ baseWorkDir, sessionsDir });
    }

    return _manager;
}

function parseMessages(sdkMessages) {
    const blocks = [];
    for (const msg of sdkMessages) {
        if (msg.type === 'user') {
            const content = msg.message?.content;
            const text =
                typeof content === 'string'
                    ? content
                    : ((Array.isArray(content)
                          ? content
                                .filter((b) => b.type === 'text')
                                .map((b) => b.text)
                                .join('\n')
                          : '') ?? '');
            if (text.trim()) blocks.push({ kind: 'user', text });
        } else if (msg.type === 'assistant') {
            const content = msg.message?.content;
            for (const block of Array.isArray(content) ? content : []) {
                if (block.type === 'text' && block.text?.trim()) {
                    blocks.push({ kind: 'text', text: block.text });
                } else if (block.type === 'tool_use') {
                    blocks.push({ kind: 'tool', name: block.name, input: block.input });
                }
            }
        }
    }
    return blocks;
}

export function handleChat(ws) {
    let sessionId = '';
    let running = false;
    let chatKey = null;
    let cwd = null;
    const pending = new Map();
    let seq = 0;

    const buildCanUseTool = async () => {
        let readOnly = READ_ONLY_REGEX;
        let timeoutMs = 120000;
        try {
            const [guard, channel] = await Promise.all([
                configService.getGuardrails(),
                configService.getChannelConfig(),
            ]);
            readOnly = guard.autoApproveReadOnlyRegex || readOnly;
            timeoutMs = channel.approvalTimeoutMs || timeoutMs;
        } catch (e) {
            logger.error(e);
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
        if (running) return send(ws, { type: 'error', message: 'The agent is busy.' });
        running = true;
        try {
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
                onSubagentEvent: (evt) => send(ws, { type: 'subagent', ...evt }),
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
                    switch (block.type) {
                        case 'text':
                            send(ws, { type: 'text', text: block.text });
                            break;
                        case 'tool_use':
                            send(ws, { type: 'tool', name: block.name, input: block.input });
                            break;
                        case 'thinking':
                            send(ws, { type: 'thinking' });
                            break;
                        default:
                            logger.warn('[chat] unknown block type: ' + block.type);
                    }
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
        } else if (msg.type === 'resume' && msg.sessionId) {
            (async () => {
                const [info, message] = await Promise.all([
                    getSessionInfo(msg.sessionId).catch(() => null),
                    getSessionMessages(msg.sessionId).catch(() => []),
                ]);
                sessionId = msg.sessionId;
                if (info?.cwd) {
                    cwd = info.cwd;
                    const basename = path.basename(info.cwd);
                    send(ws, { type: 'workspace', key: basename, dir: cwd });
                }
                send(ws, { type: 'history', messages: parseMessages(message) });
            })().catch((e) => send(ws, { type: 'error', message: e.message }));
        } else if (msg.type === 'new_chat') {
            sessionId = '';
            cwd = null;
            chatKey = null;
            for (const p of pending.values()) {
                clearTimeout(p.timer);
                p.resolve({ behavior: 'deny', message: 'Phiên mới' });
            }
            pending.clear();
            send(ws, { type: 'ready' });
        } else if (msg.type === 'list_sessions') {
            (async () => {
                const { workDir, sessionsDir } = await resolveDirs();
                const all = await listSessions().catch(() => []);
                const sessions = all
                    .filter(
                        (s) => !s.cwd || s.cwd.startsWith(sessionsDir) || s.cwd.startsWith(workDir),
                    )
                    .map((s) => ({
                        id: s.sessionId,
                        title: s.summary || s.firstPrompt || null,
                        createdAt: s.createdAt ?? s.lastModified,
                        lastModified: s.lastModified,
                        cwd: s.cwd,
                        gitBranch: s.gitBranch ?? null,
                    }))
                    .sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
                send(ws, { type: 'sessions', sessions });
            })().catch((e) => send(ws, { type: 'error', message: e.message }));
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
