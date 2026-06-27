import { Router } from 'express';
import { readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { sessionsRoot } from '../paths.js';
import { currentBranch, status } from '../git.js';

// Lists session worktrees on disk and the repos checked out in each.
export function sessionsRouter() {
    const r = Router();
    const ah = (fn) => (req, res) =>
        fn(req, res).catch((e) => res.status(500).json({ error: e.message }));

    r.get(
        '/',
        ah(async (_req, res) => {
            const root = await sessionsRoot();
            if (!existsSync(root)) return res.json([]);

            const sessions = readdirSync(root, { withFileTypes: true })
                .filter((e) => e.isDirectory())
                .map((e) => e.name);

            const out = [];
            for (const session of sessions) {
                const sdir = path.join(root, session);
                const repos = readdirSync(sdir, { withFileTypes: true })
                    .filter((e) => e.isDirectory() && existsSync(path.join(sdir, e.name, '.git')))
                    .map((e) => e.name);

                const repoInfo = [];
                for (const repo of repos) {
                    const cwd = path.join(sdir, repo);
                    const [branch, st] = await Promise.all([
                        currentBranch(cwd),
                        status(cwd).catch(() => []),
                    ]);
                    repoInfo.push({ repo, branch, changes: st.length });
                }
                out.push({
                    session,
                    mtime: statSync(sdir).mtimeMs,
                    repos: repoInfo,
                });
            }
            out.sort((a, b) => b.mtime - a.mtime);
            res.json(out);
        }),
    );

    return r;
}
