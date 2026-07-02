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
import { configService, READ_ONLY_REGEX } from '@mida/claude-config';
import { loopEngineerService } from '@mida/loop-engineer';

let cachedManager = null;
let cachedWorkDir = null;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));

const abs = (dir) => (path.isAbsolute(dir) ? dir : path.resolve(REPO_ROOT, dir));

function parseWsMessage(raw) {
    try {
        return JSON.parse(raw.toString());
    } catch {
        return null;
    }
}

async function resolveDirs() {
    let workDir = 'workspace';
    let sessionsDir = 'sessions';
    try {
        const workspace = await configService.workspace.get();
        workDir = workspace?.workDir || workDir;
        sessionsDir = workspace?.sessionsDir || sessionsDir;
    } catch (err) {
        logger.error(err);
    }
    return { workDir: abs(workDir), sessionsDir: abs(sessionsDir) };
}

async function getWorkspaceManager() {
    const { workDir: baseWorkDir, sessionsDir } = await resolveDirs();

    cachedWorkDir = baseWorkDir;

    if (!cachedManager) {
        cachedManager = new WorkspaceManager({ baseWorkDir, sessionsDir });
    }

    return cachedManager;
}

// A user SDK message's content is either a plain string or an array of blocks —
// pick out the text blocks and join them.
function extractUserText(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

function parseMessages(sdkMessages) {
    const blocks = [];

    for (const message of sdkMessages) {
        if (message.type === 'user') {
            const text = extractUserText(message.message?.content);
            if (text.trim()) blocks.push({ kind: 'user', text });
            continue;
        }
        if (message.type !== 'assistant') continue;

        const content = message.message?.content;
        for (const block of Array.isArray(content) ? content : []) {
            if (block.type === 'text' && block.text?.trim()) {
                blocks.push({ kind: 'text', text: block.text });
            } else if (block.type === 'tool_use') {
                blocks.push({ kind: 'tool', name: block.name, input: block.input });
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
        let pattern = READ_ONLY_REGEX;
        let timeoutMs = 120000;
        try {
            const [guardrail, channel] = await Promise.all([
                configService.guardrail.get(),
                configService.channel.get(),
            ]);
            pattern = guardrail.autoApproveReadOnlyRegex || pattern;
            timeoutMs = channel.approvalTimeoutMs || timeoutMs;
        } catch (err) {
            logger.error(err);
        }
        const matcher = new RegExp(pattern, 'i');

        return async (toolName, input, options) => {
            if (!toolName.startsWith('mcp__')) return { behavior: 'allow', updatedInput: input };
            const local = toolName.split('__').pop() ?? '';
            if (matcher.test(local)) return { behavior: 'allow', updatedInput: input };

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

    const ensureWorkspace = async () => {
        if (cwd) return;
        chatKey = `chat-${randomUUID().slice(0, 8)}`;
        try {
            const manager = await getWorkspaceManager();
            cwd = await manager.setup(chatKey);
            send(ws, { type: 'workspace', key: chatKey, dir: cwd });
        } catch (err) {
            logger.warn('[chat] worktree setup failed, using shared workspace: ' + err.message);
            cwd = cachedWorkDir || (await resolveDirs()).workDir;
            send(ws, { type: 'workspace', key: null, dir: cwd });
        }
    };

    // Translates one Claude Agent SDK stream event into WS message(s). `extra`
    // (e.g. { iteration: 2 }) is merged in so the client can route loop events
    // to the right iteration card instead of the main thread.
    const sendSdkEvent = (event, extra) => {
        if (event.type === 'tool_use_summary') {
            send(ws, { type: 'summary', summary: event.summary, ...extra });
            return;
        }
        if (event.type !== 'assistant') return;
        for (const block of event.message?.content ?? []) {
            switch (block.type) {
                case 'text':
                    send(ws, { type: 'text', text: block.text, ...extra });
                    break;
                case 'tool_use':
                    send(ws, { type: 'tool', name: block.name, input: block.input, ...extra });
                    break;
                case 'thinking':
                    send(ws, { type: 'thinking', ...extra });
                    break;
                default:
                    logger.warn('[chat] unknown block type: ' + block.type);
            }
        }
    };

    const run = async (text) => {
        if (running) return send(ws, { type: 'error', message: 'The agent is busy.' });
        running = true;
        try {
            await ensureWorkspace();

            const canUseTool = await buildCanUseTool();
            const options = await configService.agent.buildOptions({
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
                sendSdkEvent(event);
            }
            send(ws, { type: 'done' });
        } catch (err) {
            logger.error('[chat] ' + err.message);
            send(ws, { type: 'error', message: err.message });
        } finally {
            running = false;
        }
    };

    const onLoopEvent = (event) => {
        switch (event.type) {
            case 'iteration_start':
                send(ws, {
                    type: 'loop_iteration_start',
                    index: event.index,
                    maxIterations: event.maxIterations,
                });
                return;
            case 'iteration_end':
                send(ws, {
                    type: 'loop_iteration_end',
                    index: event.index,
                    status: event.status,
                    costUsd: event.costUsd,
                    turns: event.turns,
                    summary: event.summary,
                });
                return;
            case 'iteration_event': {
                const sdkEvent = event.event;
                if (sdkEvent.type === 'system' && sdkEvent.subtype === 'init') {
                    sessionId = sdkEvent.session_id;
                    send(ws, { type: 'session', sessionId });
                    return;
                }
                sendSdkEvent(sdkEvent, { iteration: event.index });
            }
        }
    };

    const runLoop = async (text) => {
        if (running) return send(ws, { type: 'error', message: 'The agent is busy.' });
        running = true;
        try {
            await ensureWorkspace();
            const canUseTool = await buildCanUseTool();
            const runKey = chatKey || sessionId || cwd;

            send(ws, { type: 'loop_start', runKey });
            const result = await loopEngineerService.engine.run({
                runKey,
                source: 'chat',
                prompt: text,
                cwd,
                canUseTool,
                onEvent: onLoopEvent,
            });

            send(ws, { type: 'loop_done', status: result.status });
        } catch (err) {
            logger.error('[chat] loop: ' + err.message);
            send(ws, { type: 'error', message: err.message });
        } finally {
            running = false;
        }
    };

    function handleApprovalReply(reply) {
        const entry = pending.get(reply.id);
        if (!entry) return;

        clearTimeout(entry.timer);
        pending.delete(reply.id);
        entry.resolve(
            reply.allow
                ? { behavior: 'allow', updatedInput: entry.input }
                : { behavior: 'deny', message: 'Người dùng từ chối' },
        );
    }

    async function handleResume(resumeSessionId) {
        try {
            const [info, history] = await Promise.all([
                getSessionInfo(resumeSessionId).catch(() => null),
                getSessionMessages(resumeSessionId).catch(() => []),
            ]);
            sessionId = resumeSessionId;
            if (info?.cwd) {
                cwd = info.cwd;
                send(ws, { type: 'workspace', key: path.basename(info.cwd), dir: cwd });
            }
            send(ws, { type: 'history', messages: parseMessages(history) });
        } catch (err) {
            send(ws, { type: 'error', message: err.message });
        }
    }

    function handleNewChat() {
        sessionId = '';
        cwd = null;
        chatKey = null;
        for (const entry of pending.values()) {
            clearTimeout(entry.timer);
            entry.resolve({ behavior: 'deny', message: 'Phiên mới' });
        }
        pending.clear();
        send(ws, { type: 'ready' });
    }

    async function handleListSessions() {
        try {
            const { workDir, sessionsDir } = await resolveDirs();
            const all = await listSessions().catch(() => []);
            const sessions = all
                .filter(
                    (session) =>
                        !session.cwd ||
                        session.cwd.startsWith(sessionsDir) ||
                        session.cwd.startsWith(workDir),
                )
                .map((session) => ({
                    id: session.sessionId,
                    title: session.summary || session.firstPrompt || null,
                    createdAt: session.createdAt ?? session.lastModified,
                    lastModified: session.lastModified,
                    cwd: session.cwd,
                    gitBranch: session.gitBranch ?? null,
                }))
                .sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
            send(ws, { type: 'sessions', sessions });
        } catch (err) {
            send(ws, { type: 'error', message: err.message });
        }
    }

    ws.on('message', (raw) => {
        const msg = parseWsMessage(raw);
        if (!msg) return;

        switch (msg.type) {
            case 'user':
                if (!msg.text) return;
                send(ws, { type: 'ack' });
                run(msg.text);
                return;
            case 'loop_start':
                if (!msg.text) return;
                send(ws, { type: 'ack' });
                runLoop(msg.text);
                return;
            case 'loop_stop':
                loopEngineerService.engine.stop(chatKey || sessionId || cwd);
                return;
            case 'approval_reply':
                handleApprovalReply(msg);
                return;
            case 'resume':
                if (msg.sessionId) handleResume(msg.sessionId);
                return;
            case 'new_chat':
                handleNewChat();
                return;
            case 'list_sessions':
                handleListSessions();
                return;
        }
    });

    ws.on('close', () => {
        for (const entry of pending.values()) {
            clearTimeout(entry.timer);
            entry.resolve({ behavior: 'deny', message: 'Kết nối đóng' });
        }
        pending.clear();
    });

    send(ws, { type: 'ready' });
}
