import mongoose from 'mongoose';
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { logger } from '@mida/logger';
import { registerModels } from './models/index.js';
import { seedIfEmpty } from './seed.js';
import { encrypt, decrypt } from './crypto.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function resolveClaudeBin() {
    if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;

    const pkg = `claude-agent-sdk-${process.platform}-${process.arch}`;
    const bin = process.platform === 'win32' ? 'claude.exe' : 'claude';

    const candidates = [];
    const pnpmDir = path.join(REPO_ROOT, 'node_modules/.pnpm');
    try {
        const dirs = readdirSync(pnpmDir)
            .filter((d) => d.startsWith(`@anthropic-ai+${pkg}@`))
            .sort();

        const latest = dirs.at(-1);
        if (latest) {
            candidates.push(path.join(pnpmDir, latest, 'node_modules/@anthropic-ai', pkg, bin));
        }
    } catch {
        /* no .pnpm dir */
    }
    candidates.push(path.join(REPO_ROOT, 'node_modules/@anthropic-ai', pkg, bin));

    const found = candidates.find((p) => existsSync(p));
    if (!found) {
        logger.warn(
            `[config] Claude native binary for ${process.platform}-${process.arch} not found; ` +
                'set CLAUDE_BIN to override or let the SDK auto-resolve',
        );
    }
    return found;
}

const CLAUDE_BIN = resolveClaudeBin();

class ConfigService {
    #conn = null;
    #models = null;
    #cache = new Map(); // key -> { data, ts }
    #ttlMs = 30000;
    #ready = null;

    async connect(uri, { ttlMs = 30000, seed = true } = {}) {
        if (this.#ready) return this.#ready;
        this.#ttlMs = ttlMs;
        this.#ready = (async () => {
            this.#conn = mongoose.createConnection(uri, { maxPoolSize: 5, autoIndex: true });
            await this.#conn.asPromise();
            this.#models = registerModels(this.#conn);
            await Promise.all(Object.values(this.#models).map((m) => m.init().catch(() => {})));
            if (seed) {
                const summary = await seedIfEmpty(this.#models);
                if (Object.keys(summary).length) logger.info('[config] seeded:', summary);
            }
            this.#startWatch();
            logger.info('🛠️  [config] ConfigService ready');
        })();
        return this.#ready;
    }

    get models() {
        return this.#models;
    }
    isReady() {
        return !!this.#models;
    }
    #ensure() {
        if (!this.#models) throw new Error('ConfigService not connected — call connect(uri) first');
    }

    #peek(key) {
        const e = this.#cache.get(key);
        if (e && Date.now() - e.ts < this.#ttlMs) return e.data;
        return undefined;
    }
    #store(key, data) {
        this.#cache.set(key, { data, ts: Date.now() });
        return data;
    }
    #bust(key) {
        if (key) this.#cache.delete(key);
        else this.#cache.clear();
    }
    clearCache() {
        this.#bust();
    }

    #startWatch() {
        try {
            const stream = this.#conn.watch([], { fullDocument: 'updateLookup' });
            stream.on('change', () => this.#bust());
            stream.on('error', (e) =>
                logger.warn('[config] change stream error, falling back to TTL: ' + e.message),
            );
            logger.info('[config] hot-reload via change stream enabled');
        } catch (e) {
            logger.warn(
                '[config] change stream unavailable (no replica set?), TTL cache only: ' +
                    e.message,
            );
        }
    }

    async #getSingleton(modelName, cacheKey) {
        this.#ensure();
        const hit = this.#peek(cacheKey);
        if (hit) return hit;
        const M = this.#models[modelName];
        let doc = await M.findOne().lean();
        if (!doc) doc = (await M.create({})).toObject();
        return this.#store(cacheKey, doc);
    }
    async #patchSingleton(modelName, cacheKey, patch) {
        this.#ensure();
        const M = this.#models[modelName];
        const doc = await M.findOneAndUpdate(
            {},
            { $set: patch },
            { new: true, upsert: true },
        ).lean();
        return this.#store(cacheKey, doc);
    }

    getAgentConfig() {
        return this.#getSingleton('AgentConfig', 'agent');
    }
    setAgentConfig(patch) {
        return this.#patchSingleton('AgentConfig', 'agent', patch);
    }
    getGuardrails() {
        return this.#getSingleton('Guardrail', 'guardrails');
    }
    setGuardrails(patch) {
        return this.#patchSingleton('Guardrail', 'guardrails', patch);
    }
    getChannelConfig() {
        return this.#getSingleton('ChannelConfig', 'channel');
    }
    setChannelConfig(patch) {
        return this.#patchSingleton('ChannelConfig', 'channel', patch);
    }
    getWorkspaceConfig() {
        return this.#getSingleton('WorkspaceConfig', 'workspace');
    }
    setWorkspaceConfig(patch) {
        return this.#patchSingleton('WorkspaceConfig', 'workspace', patch);
    }

    async listMcpServers() {
        this.#ensure();
        const hit = this.#peek('mcp');
        if (hit) return hit;
        const docs = await this.#models.McpServer.find().sort({ order: 1 }).lean();
        return this.#store('mcp', docs);
    }
    async upsertMcpServer(name, patch) {
        this.#ensure();
        const doc = await this.#models.McpServer.findOneAndUpdate(
            { name },
            { $set: { ...patch, name } },
            { new: true, upsert: true },
        ).lean();
        this.#bust('mcp');
        return doc;
    }
    async deleteMcpServer(name) {
        this.#ensure();
        await this.#models.McpServer.deleteOne({ name });
        this.#bust('mcp');
    }

    async listSubagents() {
        this.#ensure();
        const hit = this.#peek('subagents');
        if (hit) return hit;
        const docs = await this.#models.Subagent.find().lean();
        return this.#store('subagents', docs);
    }
    async upsertSubagent(name, patch) {
        this.#ensure();
        const doc = await this.#models.Subagent.findOneAndUpdate(
            { name },
            { $set: { ...patch, name } },
            { new: true, upsert: true },
        ).lean();
        this.#bust('subagents');
        return doc;
    }
    async deleteSubagent(name) {
        this.#ensure();
        await this.#models.Subagent.deleteOne({ name });
        this.#bust('subagents');
    }

    async setSecret(key, plain, updatedBy = 'system') {
        this.#ensure();
        const e = encrypt(String(plain));
        await this.#models.Secret.findOneAndUpdate(
            { key },
            { $set: { value: e.value, encrypted: e.encrypted, updatedBy } },
            { upsert: true },
        );
        this.#bust('secrets');
    }
    async getSecretValue(key) {
        this.#ensure();
        const doc = await this.#models.Secret.findOne({ key }).lean();
        return doc ? decrypt(doc) : undefined;
    }
    async listSecretKeys() {
        this.#ensure();
        return this.#models.Secret.find().select('key encrypted updatedBy updatedAt').lean();
    }
    async deleteSecret(key) {
        this.#ensure();
        await this.#models.Secret.deleteOne({ key });
        this.#bust('secrets');
    }
    async #allSecrets() {
        const hit = this.#peek('secrets');
        if (hit) return hit;
        const docs = await this.#models.Secret.find().lean();
        const map = {};
        for (const d of docs) map[d.key] = decrypt(d);
        return this.#store('secrets', map);
    }

    async buildClaudeBase() {
        const a = await this.getAgentConfig();
        return {
            model: a.model,
            maxTurns: a.maxTurns,
            effort: a.effort,
            permissionMode: a.permissionMode,
            settingSources: a.settingSources,
            disallowedTools: a.disallowedTools,
            allowedTools: a.allowedTools?.length ? a.allowedTools : undefined,
            systemPromptAppend: a.systemPromptAppend,
            concurrency: a.concurrency,
        };
    }

    async buildMcpServers() {
        const [servers, secrets] = await Promise.all([this.listMcpServers(), this.#allSecrets()]);
        const sub = (s) =>
            typeof s === 'string'
                ? s.replace(/\$\{secret:([^}]+)\}/g, (_, k) => secrets[k] ?? '')
                : s;
        const out = {};
        for (const s of servers) {
            if (!s.enabled) continue;
            const env = {};
            for (const e of s.env || []) {
                env[e.name] = e.secretKey ? (secrets[e.secretKey] ?? '') : (e.value ?? '');
            }
            out[s.name] = {
                command: s.command,
                args: (s.args || []).map(sub),
                ...(Object.keys(env).length ? { env } : {}),
            };
        }
        return out;
    }

    async buildAgents() {
        const subs = await this.listSubagents();
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

    async buildHooks() {
        const g = await this.getGuardrails();
        if (!g?.hooks?.preToolUse || !g.denyCommandPatterns?.length) return undefined;

        const regexes = g.denyCommandPatterns
            .map((p) => {
                try {
                    return new RegExp(p);
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
        if (!regexes.length) return undefined;

        return {
            PreToolUse: [
                {
                    hooks: [
                        async (input) => {
                            if (input.tool_name === 'Bash') {
                                const cmd = input.tool_input?.command ?? '';
                                const hit = regexes.find((re) => re.test(cmd));
                                if (hit) {
                                    return {
                                        hookSpecificOutput: {
                                            hookEventName: 'PreToolUse',
                                            permissionDecision: 'deny',
                                            permissionDecisionReason: `Blocked by guardrail: /${hit.source}/`,
                                        },
                                    };
                                }
                            }
                            return { continue: true };
                        },
                    ],
                },
            ],
        };
    }

    async buildAgentOptions({ cwd, sessionId, canUseTool } = {}) {
        const [base, mcpServers, agents, hooks] = await Promise.all([
            this.buildClaudeBase(),
            this.buildMcpServers(),
            this.buildAgents(),
            this.buildHooks(),
        ]);
        return {
            ...(CLAUDE_BIN ? { pathToClaudeCodeExecutable: CLAUDE_BIN } : {}),
            model: base.model,
            cwd,
            systemPrompt: {
                type: 'preset',
                preset: 'claude_code',
                append: base.systemPromptAppend,
            },
            settingSources: ['project', 'user'],
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
}

export const configService = new ConfigService();
