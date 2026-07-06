import { McpTarget } from '../models/index.js';

async function resolve(kind, hint = {}) {
    const query = { kind, enabled: true };

    if (hint.cluster) {
        query.cluster = hint.cluster;
    }

    return McpTarget.findOne(query).sort({ order: 1 }).lean();
}

export const router = { resolve };
