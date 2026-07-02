import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configService } from '@mida/claude-config';
import { logger } from '@mida/logger';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export async function sessionsRoot() {
    let dir = 'sessions';
    try {
        const ws = await configService.workspace.get();
        dir = ws?.sessionsDir || dir;
    } catch (e) {
        logger.error(e);
    }
    return path.isAbsolute(dir) ? dir : path.resolve(REPO_ROOT, dir);
}

export function safeJoin(root, ...parts) {
    const target = path.resolve(root, ...parts.filter(Boolean));
    if (target !== root && !target.startsWith(root + path.sep)) {
        throw new Error('Path escapes the allowed root');
    }
    return target;
}

export async function resolveRepo(session, repo) {
    const root = await sessionsRoot();
    if (!session || !repo) throw new Error('session and repo are required');
    return safeJoin(root, session, repo);
}
