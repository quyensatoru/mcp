import { buildDefaults } from './constant/defaults.constant.js';
import { encrypt } from './helper/crypto.helper.js';

export async function seedIfEmpty(models, env) {
    const defaults = buildDefaults(env);
    const summary = {};

    if (!(await models.AgentConfig.findOne())) {
        await models.AgentConfig.create({ ...defaults.agent, _k: 'singleton' });
        summary.agent = 'seeded';
    }
    if (!(await models.Guardrail.findOne())) {
        await models.Guardrail.create({ ...defaults.guardrails, _k: 'singleton' });
        summary.guardrails = 'seeded';
    }
    if (!(await models.ChannelConfig.findOne())) {
        await models.ChannelConfig.create({ ...defaults.channel, _k: 'singleton' });
        summary.channel = 'seeded';
    }
    if (!(await models.WorkspaceConfig.findOne())) {
        await models.WorkspaceConfig.create({ ...defaults.workspace, _k: 'singleton' });
        summary.workspace = 'seeded';
    }
    if ((await models.McpServer.estimatedDocumentCount()) === 0) {
        await models.McpServer.insertMany(defaults.mcpServers.map((s, i) => ({ ...s, order: i })));
        summary.mcpServers = `${defaults.mcpServers.length} seeded`;
    }

    let seededSecrets = 0;
    for (const [key, val] of Object.entries(defaults.secrets)) {
        if (val == null || val === '') continue;
        if (await models.Secret.findOne({ key })) continue;
        const e = encrypt(String(val));
        await models.Secret.create({ key, value: e.value, encrypted: e.encrypted });
        seededSecrets++;
    }
    if (seededSecrets) summary.secrets = `${seededSecrets} seeded`;

    return summary;
}
