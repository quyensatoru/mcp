import { logger } from '@mida/logger';
import { mongo } from './config/mongo.config.js';
import { env } from './config/env.config.js';
import { McpTarget } from './models/index.js';
import { registry } from './registry/registry.js';
import { router } from './router/router.js';
import { guard } from './helper/guard.helper.js';
import { seedTargets } from './seed.js';

let ready = null;

// Gộp nhiều thay đổi target liên tiếp thành một lần refresh.
function debounce(fn, ms) {
    let timer;
    return () => {
        clearTimeout(timer);
        timer = setTimeout(fn, ms);
    };
}

async function connect(uri = env.MONGO_URI, { seed = true } = {}) {
    if (ready) return ready;

    ready = (async () => {
        await mongo.connect(uri);
        await McpTarget.init().catch(() => {});

        if (seed) {
            const count = await seedTargets();
            if (count) logger.info(`[orchestrator] seeded ${count} target`);
        }

        await registry.build();

        mongo.watch(debounce(() => registry.refresh(), 500));

        logger.info('🛰️  [orchestrator] ready');
    })();

    return ready;
}

function listTargets() {
    return McpTarget.find().sort({ order: 1 }).lean();
}

function upsertTarget(name, patch) {
    return McpTarget.findOneAndUpdate(
        { name },
        { $set: { ...patch, name } },
        { new: true, upsert: true },
    ).lean();
}

function deleteTarget(name) {
    return McpTarget.deleteOne({ name });
}

export const orchestratorService = {
    connect,
    isReady: mongo.isReady,
    registry: {
        catalog: registry.catalog,
        callTool: registry.callTool,
        refresh: registry.refresh,
    },
    guard: { check: guard.check },
    router: { resolve: router.resolve },
    target: { list: listTargets, upsert: upsertTarget, delete: deleteTarget },
};
