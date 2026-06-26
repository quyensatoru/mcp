import path from 'node:path';
import { mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { logger } from '@mida/logger';
import { discoverRepos } from './repo-discovery.js';
import {
    addWorktree,
    addWorktreeExistingBranch,
    removeWorktree,
    deleteBranch,
    worktreeExists,
    branchExists,
    pruneWorktrees,
} from './git-worktree.js';

// Convert an arbitrary string (e.g. a Mattermost post ID) into a name safe
// for both filesystem paths and git branch names.
function sanitize(key) {
    return key.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/^-+|-+$/g, '');
}

// Git branch used as the starting point for a session's worktrees.
// The agent may create additional branches from within each worktree.
function worktreeBranch(sessionKey) {
    return `wt/${sanitize(sessionKey)}`;
}

export class WorkspaceManager {
    #baseWorkDir;
    #sessionsDir;

    constructor({ baseWorkDir, sessionsDir }) {
        this.#baseWorkDir = baseWorkDir;
        this.#sessionsDir = sessionsDir;
    }

    // Absolute path to the session-specific workspace directory.
    getWorkDir(sessionKey) {
        return path.join(this.#sessionsDir, sanitize(sessionKey));
    }

    // Returns true when the session directory already exists on disk.
    hasWorkDir(sessionKey) {
        return existsSync(this.getWorkDir(sessionKey));
    }

    // Create a worktree for every repo in baseWorkDir, all under a single
    // session directory. Idempotent: skips repos whose worktree already exists.
    // Returns the session workspace path.
    async setup(sessionKey) {
        const sessionDir = this.getWorkDir(sessionKey);
        const branch = worktreeBranch(sessionKey);
        const repos = discoverRepos(this.#baseWorkDir);

        mkdirSync(sessionDir, { recursive: true });

        await Promise.all(
            repos.map(async (repoDir) => {
                const repoName = path.basename(repoDir);
                const worktreePath = path.join(sessionDir, repoName);

                if (existsSync(worktreePath)) {
                    logger.debug(`[workspace] skip existing worktree: ${repoName}`);
                    return;
                }

                try {
                    if (await branchExists(repoDir, branch)) {
                        await addWorktreeExistingBranch(repoDir, worktreePath, branch);
                    } else {
                        await addWorktree(repoDir, worktreePath, branch);
                    }
                    logger.debug(`[workspace] created worktree: ${repoName} → ${worktreePath}`);
                } catch (err) {
                    logger.warn(`[workspace] worktree setup failed for ${repoName}: ${err.message}`);
                }
            }),
        );

        return sessionDir;
    }

    // Remove all worktrees for a session and delete the session directory.
    // The agent's feature branches (bugfixsupport/*, etc.) are NOT deleted —
    // only the wt/* base branch and its worktree checkout are cleaned up.
    async teardown(sessionKey) {
        const sessionDir = this.getWorkDir(sessionKey);
        const branch = worktreeBranch(sessionKey);
        const repos = discoverRepos(this.#baseWorkDir);

        await Promise.all(
            repos.map(async (repoDir) => {
                const repoName = path.basename(repoDir);
                const worktreePath = path.join(sessionDir, repoName);

                try {
                    if (await worktreeExists(repoDir, worktreePath)) {
                        await removeWorktree(repoDir, worktreePath);
                    }
                    await pruneWorktrees(repoDir);

                    if (await branchExists(repoDir, branch)) {
                        await deleteBranch(repoDir, branch);
                    }
                    logger.debug(`[workspace] removed worktree: ${repoName}`);
                } catch (err) {
                    logger.warn(`[workspace] worktree teardown failed for ${repoName}: ${err.message}`);
                }
            }),
        );

        try {
            rmSync(sessionDir, { recursive: true, force: true });
        } catch (err) {
            logger.warn(`[workspace] failed to remove session dir: ${err.message}`);
        }
    }

    // Delete session workspaces that have not been modified in more than maxAgeMs.
    // Default: 7 days. Intended to be called once at process startup.
    async cleanupOld(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
        if (!existsSync(this.#sessionsDir)) return;

        const now = Date.now();
        const stale = readdirSync(this.#sessionsDir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .filter((e) => now - statSync(path.join(this.#sessionsDir, e.name)).mtimeMs > maxAgeMs)
            .map((e) => e.name);

        for (const sessionKey of stale) {
            logger.info(`[workspace] removing stale session: ${sessionKey}`);
            await this.teardown(sessionKey);
        }
    }
}
