import { Router } from 'express';
import { resolveRepo } from '../paths.js';
import { git, status, currentBranch } from '../git.js';

// Git status / diff / stage / commit for a repo inside a session worktree.
export function gitRouter() {
    const r = Router();
    const ah = (fn) => (req, res) =>
        fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

    r.get(
        '/status',
        ah(async (req, res) => {
            const cwd = await resolveRepo(req.query.session, req.query.repo);
            const [branch, files] = await Promise.all([currentBranch(cwd), status(cwd)]);
            res.json({ branch, files });
        }),
    );

    // GET /diff?session=&repo=&file=  → unified diff (untracked files shown as added)
    r.get(
        '/diff',
        ah(async (req, res) => {
            const cwd = await resolveRepo(req.query.session, req.query.repo);
            const file = req.query.file;
            let diff = '';
            try {
                diff = await git(['diff', '--', file], cwd);
                if (!diff) diff = await git(['diff', '--cached', '--', file], cwd);
                if (!diff) diff = await git(['diff', '--no-index', '--', '/dev/null', file], cwd);
            } catch (e) {
                // `git diff --no-index` exits 1 when there IS a diff — its stdout is on the error.
                diff = e.stdout || '';
            }
            res.json({ diff });
        }),
    );

    r.post(
        '/stage',
        ah(async (req, res) => {
            const cwd = await resolveRepo(req.body.session, req.body.repo);
            const files = req.body.files?.length ? req.body.files : ['-A'];
            await git(['add', ...files], cwd);
            res.json({ ok: true });
        }),
    );

    r.post(
        '/commit',
        ah(async (req, res) => {
            const { session, repo, message, files } = req.body;
            if (!message) return res.status(400).json({ error: 'commit message is required' });
            const cwd = await resolveRepo(session, repo);
            await git(['add', ...(files?.length ? files : ['-A'])], cwd);
            const out = await git(['commit', '-m', message], cwd);
            res.json({ ok: true, output: out.trim() });
        }),
    );

    return r;
}
