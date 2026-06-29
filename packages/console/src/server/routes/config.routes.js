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
                    configService.getAgentConfig(),
                    configService.listMcpServers(),
                    configService.listSubagents(),
                    configService.getGuardrails(),
                    configService.getChannelConfig(),
                    configService.getWorkspaceConfig(),
                    configService.listSecretKeys(),
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
    singleton(
        '/agent',
        () => configService.getAgentConfig(),
        (b) => configService.setAgentConfig(b),
    );
    singleton(
        '/guardrails',
        () => configService.getGuardrails(),
        (b) => configService.setGuardrails(b),
    );
    singleton(
        '/channel',
        () => configService.getChannelConfig(),
        (b) => configService.setChannelConfig(b),
    );
    singleton(
        '/workspace',
        () => configService.getWorkspaceConfig(),
        (b) => configService.setWorkspaceConfig(b),
    );

    r.get(
        '/mcp-servers',
        wraper(async (_req, res) => res.json(await configService.listMcpServers())),
    );
    r.post(
        '/mcp-servers',
        wraper(async (req, res) => {
            const { name, ...rest } = req.body;
            if (!name) return res.status(400).json({ error: 'name is required' });
            res.json(await configService.upsertMcpServer(name, rest));
        }),
    );
    r.delete(
        '/mcp-servers/:name',
        wraper(async (req, res) => {
            await configService.deleteMcpServer(req.params.name);
            res.json({ ok: true });
        }),
    );

    r.get(
        '/subagents',
        wraper(async (_req, res) => res.json(await configService.listSubagents())),
    );
    r.post(
        '/subagents',
        wraper(async (req, res) => {
            const { name, ...rest } = req.body;
            if (!name) return res.status(400).json({ error: 'name is required' });
            res.json(await configService.upsertSubagent(name, rest));
        }),
    );
    r.delete(
        '/subagents/:name',
        wraper(async (req, res) => {
            await configService.deleteSubagent(req.params.name);
            res.json({ ok: true });
        }),
    );

    r.get(
        '/secrets',
        wraper(async (_req, res) => res.json(await configService.listSecretKeys())),
    );
    r.put(
        '/secrets/:key',
        wraper(async (req, res) => {
            if (req.body?.value == null)
                return res.status(400).json({ error: 'value is required' });
            await configService.setSecret(req.params.key, req.body.value, 'console');
            res.json({ ok: true });
        }),
    );
    r.delete(
        '/secrets/:key',
        wraper(async (req, res) => {
            await configService.deleteSecret(req.params.key);
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
