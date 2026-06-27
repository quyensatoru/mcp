import { Router } from 'express';
import { readdirSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveRepo, safeJoin } from '../paths.js';

const IGNORE = new Set(['.git', 'node_modules', 'dist', '.cache']);
const MAX_READ = 2 * 1024 * 1024;

// File tree (lazy, per-directory) + read/write within a session worktree.
export function filesRouter() {
    const r = Router();
    const ah = (fn) => (req, res) =>
        fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

    // GET /tree?session=&repo=&dir=relative  → immediate children of `dir`
    r.get(
        '/tree',
        ah(async (req, res) => {
            const repoRoot = await resolveRepo(req.query.session, req.query.repo);
            const dir = safeJoin(repoRoot, req.query.dir || '');
            const entries = readdirSync(dir, { withFileTypes: true })
                .filter((e) => !IGNORE.has(e.name))
                .map((e) => ({
                    name: e.name,
                    type: e.isDirectory() ? 'dir' : 'file',
                    path: path.relative(repoRoot, path.join(dir, e.name)).replaceAll('\\', '/'),
                }))
                .sort((a, b) =>
                    a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1,
                );
            res.json(entries);
        }),
    );

    // GET /read?session=&repo=&file=relative
    r.get(
        '/read',
        ah(async (req, res) => {
            const repoRoot = await resolveRepo(req.query.session, req.query.repo);
            const file = safeJoin(repoRoot, req.query.file);
            if (statSync(file).size > MAX_READ) throw new Error('File too large to open');
            res.json({ content: await readFile(file, 'utf8') });
        }),
    );

    // PUT /write  { session, repo, file, content }
    r.put(
        '/write',
        ah(async (req, res) => {
            const { session, repo, file, content } = req.body;
            const repoRoot = await resolveRepo(session, repo);
            const target = safeJoin(repoRoot, file);
            await writeFile(target, content ?? '', 'utf8');
            res.json({ ok: true });
        }),
    );

    return r;
}
