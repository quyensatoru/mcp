import { Router } from 'express';
import { listSessions, getSessionMessages } from '@anthropic-ai/claude-agent-sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configService } from '../../config/index.js';
import { logger } from '@mida/logger';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
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

export function chatSessionsRouter() {
    const route = Router();
    const ah = (fn) => (req, res) =>
        fn(req, res).catch((e) => res.status(500).json({ error: e.message }));

    route.get(
        '/',
        ah(async (_req, res) => {
            const { workDir, sessionsDir } = await resolveDirs();
            const all = await listSessions().catch(() => []);
            const sessions = all
                .filter((s) => {
                    if (!s.cwd) return false;

                    return s.cwd.startsWith(sessionsDir);
                })
                .map((s) => ({
                    id: s.sessionId,
                    title: s.summary || s.firstPrompt || null,
                    createdAt: s.createdAt ?? s.lastModified,
                    lastModified: s.lastModified,
                    cwd: s.cwd,
                    gitBranch: s.gitBranch ?? null,
                    worktreeKey: path.basename(s.cwd),
                }))
                .sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
            res.json(sessions);
        }),
    );

    route.get(
        '/:sessionId/messages',
        ah(async (req, res) => {
            const sdkMessages = await getSessionMessages(req.params.sessionId).catch(() => null);
            if (!sdkMessages) return res.status(404).json({ error: 'Session not found' });
            res.json(parseMessages(sdkMessages));
        }),
    );

    return route;
}
