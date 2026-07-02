import { Router } from 'express';

export function configRouter(configService) {
    const r = Router();
    const wraper = (fn) => (req, res) =>
        fn(req, res).catch((e) => res.status(500).json({ error: e.message }));

    r.get(
        '/',
        wraper(async (_req, res) => {
            const [agent, mcpServers, subagents, guardrails, channel, workspace, secrets] =
                await Promise.all([
                    configService.agent.get(),
                    configService.mcp.list(),
                    configService.subagent.list(),
                    configService.guardrail.get(),
                    configService.channel.get(),
                    configService.workspace.get(),
                    configService.secret.list(),
                ]);
            res.json({ agent, mcpServers, subagents, guardrails, channel, workspace, secrets });
        }),
    );

    const singleton = (path, get, set) => {
        r.get(
            path,
            wraper(async (_req, res) => res.json(await get())),
        );
        r.patch(
            path,
            wraper(async (req, res) => res.json(await set(req.body))),
        );
    };
    singleton('/agent', configService.agent.get, configService.agent.set);
    singleton('/guardrails', configService.guardrail.get, configService.guardrail.set);
    singleton('/channel', configService.channel.get, configService.channel.set);
    singleton('/workspace', configService.workspace.get, configService.workspace.set);

    r.get(
        '/mcp-servers',
        wraper(async (_req, res) => res.json(await configService.mcp.list())),
    );
    r.post(
        '/mcp-servers',
        wraper(async (req, res) => {
            const { name, ...rest } = req.body;
            if (!name) return res.status(400).json({ error: 'name is required' });
            res.json(await configService.mcp.upsert(name, rest));
        }),
    );
    r.delete(
        '/mcp-servers/:name',
        wraper(async (req, res) => {
            await configService.mcp.delete(req.params.name);
            res.json({ ok: true });
        }),
    );

    r.get(
        '/subagents',
        wraper(async (_req, res) => res.json(await configService.subagent.list())),
    );
    r.post(
        '/subagents',
        wraper(async (req, res) => {
            const { name, ...rest } = req.body;
            if (!name) return res.status(400).json({ error: 'name is required' });
            res.json(await configService.subagent.upsert(name, rest));
        }),
    );
    r.delete(
        '/subagents/:name',
        wraper(async (req, res) => {
            await configService.subagent.delete(req.params.name);
            res.json({ ok: true });
        }),
    );

    r.get(
        '/secrets',
        wraper(async (_req, res) => res.json(await configService.secret.list())),
    );
    r.put(
        '/secrets/:key',
        wraper(async (req, res) => {
            if (req.body?.value == null)
                return res.status(400).json({ error: 'value is required' });
            await configService.secret.set(req.params.key, req.body.value, 'console');
            res.json({ ok: true });
        }),
    );
    r.delete(
        '/secrets/:key',
        wraper(async (req, res) => {
            await configService.secret.delete(req.params.key);
            res.json({ ok: true });
        }),
    );

    r.post(
        '/reload',
        wraper(async (_req, res) => {
            configService.clearCache();
            res.json({ ok: true });
        }),
    );

    return r;
}
