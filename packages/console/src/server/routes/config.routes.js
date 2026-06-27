import { Router } from 'express';

// REST CRUD over the config layer. Singletons use GET/PATCH; collections use
// GET/POST(upsert)/DELETE. Secrets never return their plaintext values.
export function configRouter(configService) {
    const r = Router();
    const ah = (fn) => (req, res) =>
        fn(req, res).catch((e) => res.status(500).json({ error: e.message }));

    // Everything the dashboard needs for an initial load.
    r.get(
        '/',
        ah(async (_req, res) => {
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

    // ---- singletons ----
    const singleton = (path, get, set) => {
        r.get(
            path,
            ah(async (_req, res) => res.json(await get())),
        );
        r.patch(
            path,
            ah(async (req, res) => res.json(await set(req.body))),
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

    // ---- mcp servers ----
    r.get(
        '/mcp-servers',
        ah(async (_req, res) => res.json(await configService.listMcpServers())),
    );
    r.post(
        '/mcp-servers',
        ah(async (req, res) => {
            const { name, ...rest } = req.body;
            if (!name) return res.status(400).json({ error: 'name is required' });
            res.json(await configService.upsertMcpServer(name, rest));
        }),
    );
    r.delete(
        '/mcp-servers/:name',
        ah(async (req, res) => {
            await configService.deleteMcpServer(req.params.name);
            res.json({ ok: true });
        }),
    );

    // ---- subagents ----
    r.get(
        '/subagents',
        ah(async (_req, res) => res.json(await configService.listSubagents())),
    );
    r.post(
        '/subagents',
        ah(async (req, res) => {
            const { name, ...rest } = req.body;
            if (!name) return res.status(400).json({ error: 'name is required' });
            res.json(await configService.upsertSubagent(name, rest));
        }),
    );
    r.delete(
        '/subagents/:name',
        ah(async (req, res) => {
            await configService.deleteSubagent(req.params.name);
            res.json({ ok: true });
        }),
    );

    // ---- secrets (values are write-only via the API) ----
    r.get(
        '/secrets',
        ah(async (_req, res) => res.json(await configService.listSecretKeys())),
    );
    r.put(
        '/secrets/:key',
        ah(async (req, res) => {
            if (req.body?.value == null)
                return res.status(400).json({ error: 'value is required' });
            await configService.setSecret(req.params.key, req.body.value, 'console');
            res.json({ ok: true });
        }),
    );
    r.delete(
        '/secrets/:key',
        ah(async (req, res) => {
            await configService.deleteSecret(req.params.key);
            res.json({ ok: true });
        }),
    );

    // Manual hot-reload — needed on standalone Mongo (no change stream).
    r.post(
        '/reload',
        ah(async (_req, res) => {
            configService.clearCache();
            res.json({ ok: true });
        }),
    );

    return r;
}
