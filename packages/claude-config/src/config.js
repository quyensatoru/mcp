import { logger } from '@mida/logger';
import { mongo } from './config/mongo.config.js';
import { env } from './config/env.config.js';
import { models } from './models/index.js';
import { cache } from './helper/cache.helper.js';
import { resolveClaudeBin } from './helper/claude-bin.helper.js';
import { encrypt, decrypt } from './helper/crypto.helper.js';
import { seedIfEmpty } from './seed.js';

const CLAUDE_BIN = resolveClaudeBin();

let ready = null;

async function connect(uri, { ttlMs = 30000, seed = true } = {}) {
    if (ready) return ready;
    cache.configure(ttlMs);

    ready = (async () => {
        await mongo.connect(uri);
        await Promise.all(Object.values(models).map((m) => m.init().catch(() => {})));

        if (seed) {
            const summary = await seedIfEmpty(models, env);
            if (Object.keys(summary).length) logger.info('[claude-config] seeded:', summary);
        }

        mongo.watch(() => cache.clear());
        logger.info('🛠️  [claude-config] ready');
    })();

    return ready;
}

async function getSingleton(modelName, cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit) return hit;

    const Model = models[modelName];
    const doc = (await Model.findOne().lean()) ?? (await Model.create({})).toObject();
    return cache.set(cacheKey, doc);
}

async function patchSingleton(modelName, cacheKey, patch) {
    const Model = models[modelName];
    const doc = await Model.findOneAndUpdate(
        {},
        { $set: patch },
        { new: true, upsert: true },
    ).lean();
    return cache.set(cacheKey, doc);
}

const getAgentConfig = () => getSingleton('AgentConfig', 'agent');
const setAgentConfig = (patch) => patchSingleton('AgentConfig', 'agent', patch);
const getGuardrails = () => getSingleton('Guardrail', 'guardrails');
const setGuardrails = (patch) => patchSingleton('Guardrail', 'guardrails', patch);
const getChannelConfig = () => getSingleton('ChannelConfig', 'channel');
const setChannelConfig = (patch) => patchSingleton('ChannelConfig', 'channel', patch);
const getWorkspaceConfig = () => getSingleton('WorkspaceConfig', 'workspace');
const setWorkspaceConfig = (patch) => patchSingleton('WorkspaceConfig', 'workspace', patch);

async function listMcpServers() {
    const hit = cache.get('mcp');
    if (hit) return hit;
    const docs = await models.McpServer.find().sort({ order: 1 }).lean();
    return cache.set('mcp', docs);
}
async function upsertMcpServer(name, patch) {
    const doc = await models.McpServer.findOneAndUpdate(
        { name },
        { $set: { ...patch, name } },
        { new: true, upsert: true },
    ).lean();
    cache.clear('mcp');
    return doc;
}
async function deleteMcpServer(name) {
    await models.McpServer.deleteOne({ name });
    cache.clear('mcp');
}

async function listSubagents() {
    const hit = cache.get('subagents');
    if (hit) return hit;
    const docs = await models.Subagent.find().lean();
    return cache.set('subagents', docs);
}
async function upsertSubagent(name, patch) {
    const doc = await models.Subagent.findOneAndUpdate(
        { name },
        { $set: { ...patch, name } },
        { new: true, upsert: true },
    ).lean();
    cache.clear('subagents');
    return doc;
}
async function deleteSubagent(name) {
    await models.Subagent.deleteOne({ name });
    cache.clear('subagents');
}

async function setSecret(key, plain, updatedBy = 'system') {
    const e = encrypt(String(plain));
    await models.Secret.findOneAndUpdate(
        { key },
        { $set: { value: e.value, encrypted: e.encrypted, updatedBy } },
        { upsert: true },
    );
    cache.clear('secrets');
}
async function getSecretValue(key) {
    const doc = await models.Secret.findOne({ key }).lean();
    return doc ? decrypt(doc) : undefined;
}
async function listSecretKeys() {
    return models.Secret.find().select('key encrypted updatedBy updatedAt').lean();
}
async function deleteSecret(key) {
    await models.Secret.deleteOne({ key });
    cache.clear('secrets');
}
async function allSecrets() {
    const hit = cache.get('secrets');
    if (hit) return hit;
    const docs = await models.Secret.find().lean();
    const map = {};
    for (const d of docs) map[d.key] = decrypt(d);
    return cache.set('secrets', map);
}

async function buildClaudeBase() {
    const a = await getAgentConfig();
    return {
        model: a.model,
        maxTurns: a.maxTurns,
        effort: a.effort,
        permissionMode: a.permissionMode,
        settingSources: a.settingSources,
        disallowedTools: a.disallowedTools,
        allowedTools: a.allowedTools?.length ? a.allowedTools : undefined,
        systemPromptAppend: a.systemPromptAppend,
    };
}

async function buildMcpServers() {
    const [servers, secrets] = await Promise.all([listMcpServers(), allSecrets()]);
    const sub = (s) =>
        typeof s === 'string' ? s.replace(/\$\{secret:([^}]+)\}/g, (_, k) => secrets[k] ?? '') : s;

    const out = {};
    for (const s of servers) {
        if (!s.enabled) continue;
        const envMap = {};
        for (const e of s.env || []) {
            envMap[e.name] = e.secretKey ? (secrets[e.secretKey] ?? '') : (e.value ?? '');
        }
        out[s.name] = {
            command: s.command,
            args: (s.args || []).map(sub),
            ...(Object.keys(envMap).length ? { env: envMap } : {}),
        };
    }
    return out;
}

async function buildAgents() {
    const subs = await listSubagents();
    const out = {};
    for (const s of subs) {
        if (!s.enabled) continue;
        out[s.name] = {
            description: s.description,
            prompt: s.prompt,
            ...(s.model ? { model: s.model } : {}),
            ...(s.tools?.length ? { tools: s.tools } : {}),
        };
    }
    return out;
}

function buildDenyHook(regexes) {
    return async (input) => {
        if (input.tool_name !== 'Bash') return { continue: true };

        const cmd = input.tool_input?.command ?? '';
        const hit = regexes.find((re) => re.test(cmd));
        if (!hit) return { continue: true };

        return {
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: `Blocked by guardrail: /${hit.source}/`,
            },
        };
    };
}

function buildSubagentEventHooks(onSubagentEvent, existingPreToolUse) {
    const onStart = async (input) => {
        onSubagentEvent({ phase: 'start', agentId: input.agent_id, agentType: input.agent_type });
        return { continue: true };
    };
    const onStop = async (input) => {
        onSubagentEvent({
            phase: 'stop',
            agentId: input.agent_id,
            agentType: input.agent_type,
            text: input.last_assistant_message,
        });
        return { continue: true };
    };
    const onTool = async (input) => {
        if (!input.agent_id) return { continue: true };

        onSubagentEvent({
            phase: 'tool',
            agentId: input.agent_id,
            agentType: input.agent_type,
            toolName: input.tool_name,
            toolInput: input.tool_input,
        });
        return { continue: true };
    };

    return {
        SubagentStart: [{ hooks: [onStart] }],
        SubagentStop: [{ hooks: [onStop] }],
        PreToolUse: [...(existingPreToolUse || []), { hooks: [onTool] }],
    };
}

async function buildHooks(onSubagentEvent) {
    const g = await getGuardrails();
    const hooks = {};

    const patterns = g?.hooks?.preToolUse ? g.denyCommandPatterns : [];
    const regexes = (patterns || [])
        .map((p) => {
            try {
                return new RegExp(p);
            } catch {
                return null;
            }
        })
        .filter(Boolean);

    if (regexes.length) {
        hooks.PreToolUse = [{ hooks: [buildDenyHook(regexes)] }];
    }

    if (onSubagentEvent) {
        Object.assign(hooks, buildSubagentEventHooks(onSubagentEvent, hooks.PreToolUse));
    }

    return Object.keys(hooks).length ? hooks : undefined;
}

async function buildAgentOptions({ cwd, sessionId, canUseTool, onSubagentEvent } = {}) {
    const [base, mcpServers, agents, hooks] = await Promise.all([
        buildClaudeBase(),
        buildMcpServers(),
        buildAgents(),
        buildHooks(onSubagentEvent),
    ]);

    return {
        ...(CLAUDE_BIN ? { pathToClaudeCodeExecutable: CLAUDE_BIN } : {}),
        model: base.model,
        cwd,
        systemPrompt: { type: 'preset', preset: 'claude_code', append: base.systemPromptAppend },
        settingSources: base.settingSources,
        permissionMode: base.permissionMode,
        ...(sessionId ? { resume: sessionId } : {}),
        mcpServers,
        ...(Object.keys(agents).length ? { agents } : {}),
        ...(hooks ? { hooks } : {}),
        maxTurns: base.maxTurns,
        effort: base.effort,
        disallowedTools: base.disallowedTools,
        ...(base.allowedTools ? { allowedTools: base.allowedTools } : {}),
        canUseTool,
    };
}

export const configService = {
    connect,
    isReady: mongo.isReady,
    getConnection: mongo.getConnection,
    clearCache: cache.clear,

    agent: {
        get: getAgentConfig,
        set: setAgentConfig,
        buildBase: buildClaudeBase,
        buildOptions: buildAgentOptions,
    },
    guardrail: {
        get: getGuardrails,
        set: setGuardrails,
        buildHooks,
    },
    channel: {
        get: getChannelConfig,
        set: setChannelConfig,
    },
    workspace: {
        get: getWorkspaceConfig,
        set: setWorkspaceConfig,
    },
    mcp: {
        list: listMcpServers,
        upsert: upsertMcpServer,
        delete: deleteMcpServer,
        build: buildMcpServers,
    },
    subagent: {
        list: listSubagents,
        upsert: upsertSubagent,
        delete: deleteSubagent,
        build: buildAgents,
    },
    secret: {
        get: getSecretValue,
        set: setSecret,
        list: listSecretKeys,
        delete: deleteSecret,
        all: allSecrets,
    },
};
