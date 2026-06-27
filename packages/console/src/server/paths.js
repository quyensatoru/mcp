import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configService } from '../config/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

// Absolute root that holds all per-session worktrees (same dir the agent writes to).
export async function sessionsRoot() {
    let dir = 'sessions';
    try {
        const ws = await configService.getWorkspaceConfig();
        dir = ws?.sessionsDir || dir;
    } catch {
        /* config not ready — fall back */
    }
    return path.isAbsolute(dir) ? dir : path.resolve(REPO_ROOT, dir);
}

// Resolve a path under `root` and refuse anything that escapes it (traversal guard).
export function safeJoin(root, ...parts) {
    const target = path.resolve(root, ...parts.filter(Boolean));
    if (target !== root && !target.startsWith(root + path.sep)) {
        throw new Error('Path escapes the allowed root');
    }
    return target;
}

// Absolute path to a repo checkout inside a session worktree.
export async function resolveRepo(session, repo) {
    const root = await sessionsRoot();
    if (!session || !repo) throw new Error('session and repo are required');
    return safeJoin(root, session, repo);
}
