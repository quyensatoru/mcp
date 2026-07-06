import { logger } from '@mida/logger';
import { env } from '../config/env.config.js';
import { McpTarget } from '../models/index.js';
import { connectTransport } from '../helper/mcp-client.helper.js';
import { toLocal } from '../helper/namespace.helper.js';
import { KIND_TEMPLATES, TOOL_ALLOW } from '../constant/defaults.constant.js';

const clients = new Map();
const byLocal = new Map();
const targetsByName = new Map();
const backoff = new Map();
let vault = {};
let closing = false;
const MAX_BACKOFF_MS = 30000;

function buildVault() {
    const out = {};
    const kinds = {
        mongo: env.MONGO_TARGETS,
        rabbit: env.RABBIT_TARGETS,
        redis: env.REDIS_TARGETS,
    };
    for (const [kind, list] of Object.entries(kinds)) {
        for (const item of list) out[`${kind}-${item.cluster}`] = item.conn;
    }
    return out;
}

function resolveEnv(target) {
    const tpl = KIND_TEMPLATES[target.kind];
    const conn = vault[target.name];
    if (!tpl?.buildEnv || !conn) return null;
    try {
        return tpl.buildEnv(conn);
    } catch (err) {
        logger.warn(`[registry] ${target.name} conn parse lỗi: ${err.message}`);
        return null;
    }
}

function removeTargetTools(name) {
    for (const [localName, e] of byLocal) {
        if (e.target.name === name) byLocal.delete(localName);
    }
}

function scheduleReconnect(name) {
    const attempts = (backoff.get(name) ?? 0) + 1;
    backoff.set(name, attempts);
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (attempts - 1));
    logger.warn(`[registry] ${name} reconnect sau ${delay}ms (lần ${attempts})`);
    setTimeout(() => reconnectTarget(name).catch(() => {}), delay);
}

async function connectTarget(target) {
    const spawnEnv = resolveEnv(target);
    if (!spawnEnv) {
        logger.warn(`[registry] bỏ qua ${target.name}: thiếu connection string`);
        return;
    }

    const client = await connectTransport(target, spawnEnv);
    const { tools } = await client.listTools();

    client.onclose = () => {
        if (closing) return;
        clients.delete(target.name);
        removeTargetTools(target.name);
        scheduleReconnect(target.name);
    };

    const allow = TOOL_ALLOW[target.kind];
    const exposed = allow ? tools.filter((t) => allow.includes(t.name)) : tools;

    clients.set(target.name, { client, target });
    for (const tool of exposed) {
        byLocal.set(toLocal(target, tool.name), { target, tool: tool.name, def: tool });
    }
    backoff.set(target.name, 0);
    logger.info(`[registry] ${target.name}: ${tools.length} tool`);
}

async function reconnectTarget(name) {
    const old = clients.get(name);
    clients.delete(name);
    removeTargetTools(name);
    if (old) {
        try {
            await old.client.close();
        } catch {
            // ignore
        }
    }

    const target = targetsByName.get(name);
    if (!target) return;

    try {
        await connectTarget(target);
    } catch (err) {
        logger.warn(`[registry] ${name} reconnect lỗi: ${err.message}`);
        scheduleReconnect(name);
    }
}

async function build() {
    vault = buildVault();
    const targets = await McpTarget.find({ enabled: true }).sort({ order: 1 }).lean();

    targetsByName.clear();
    for (const target of targets) targetsByName.set(target.name, target);

    await Promise.all(
        targets.map((target) =>
            connectTarget(target).catch((err) =>
                logger.warn(`[registry] ${target.name} connect lỗi: ${err.message}`),
            ),
        ),
    );
    logger.info(`[registry] ${clients.size}/${targets.length} target online, ${byLocal.size} tool`);
}

function catalog() {
    return [...byLocal.entries()].map(([localName, e]) => ({
        localName,
        description: e.def?.description ?? '',
        inputSchema: e.def?.inputSchema ?? { type: 'object' },
        target: e.target.name,
        kind: e.target.kind,
        cluster: e.target.cluster,
        capability: e.target.capability,
        tool: e.tool,
    }));
}

function entry(localName) {
    return byLocal.get(localName) ?? null;
}

async function callTool(localName, args) {
    const e = byLocal.get(localName);
    if (!e) throw new Error(`unknown tool: ${localName}`);

    let conn = clients.get(e.target.name);
    if (!conn) {
        await reconnectTarget(e.target.name);
        conn = clients.get(e.target.name);
    }
    if (!conn) throw new Error(`target offline: ${e.target.name}`);

    try {
        return await conn.client.callTool({ name: e.tool, arguments: args ?? {} });
    } catch (err) {
        logger.warn(`[registry] ${localName} lỗi (${err.message}), reconnect & retry`);
        await reconnectTarget(e.target.name);
        const retry = clients.get(e.target.name);
        if (!retry) throw err;
        return retry.client.callTool({ name: e.tool, arguments: args ?? {} });
    }
}

function targets() {
    return [...clients.values()].map(({ target }) => target);
}

async function refresh() {
    closing = true;
    for (const { client } of clients.values()) {
        try {
            await client.close();
        } catch {
            // ignore
        }
    }
    clients.clear();
    byLocal.clear();
    closing = false;
    await build();
}

export const registry = { build, catalog, entry, callTool, targets, refresh };
