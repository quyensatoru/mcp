import { Router } from 'express';
import { resolveRepo } from '../paths.js';
import { git, getCurrentBranch, getStatus } from '@mida/workspace';
import { logger } from '@mida/logger';
import { WorkspaceManager } from '@mida/workspace';

export function gitRouter() {
    const route = Router();
    const wraper = (fn) => (req, res) =>
        fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

    route.get(
        '/status',
        wraper(async (req, res) => {
            const { session, repo } = req.query;
            const cwd = await resolveRepo(session, repo);

            const [branch, files] = await Promise.all([getCurrentBranch(cwd), getStatus(cwd)]);

            res.json({ branch, files });
        }),
    );

    route.get(
        '/diff',
        wraper(async (req, res) => {
            const { session, repo, file } = req.query;
            const cwd = await resolveRepo(session, repo);

            let diff = '';

            try {
                diff = await git(['diff', '--', file], cwd);
                if (!diff) {
                    diff = await git(['diff', '--cached', '--', file], cwd);
                }
                if (!diff) {
                    diff = await git(['diff', '--no-index', '--', '/dev/null', file], cwd);
                }
            } catch (e) {
                logger.error(e);
                diff = e.stdout || '';
            }
            res.json({ diff });
        }),
    );

    route.post(
        '/stage',
        wraper(async (req, res) => {
            const { session, repo, files } = req.body;
            const cwd = await resolveRepo(session, repo);

            const f = files?.length ? files : ['-A'];

            await git(['add', ...f], cwd);

            res.json({ ok: true });
        }),
    );

    route.post(
        '/commit',
        wraper(async (req, res) => {
            const { session, repo, message, files } = req.body;
            if (!message) {
                return res.status(400).json({ error: 'commit message is required' });
            }

            const cwd = await resolveRepo(session, repo);

            await git(['add', ...(files?.length ? files : ['-A'])], cwd);

            const out = await git(['commit', '-m', message], cwd);

            res.json({ ok: true, output: out.trim() });
        }),
    );

    return route;
}
