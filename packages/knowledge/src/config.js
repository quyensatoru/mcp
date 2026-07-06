import { logger } from '@mida/logger';
import { mongo } from './config/mongo.config.js';
import { env } from './config/env.config.js';
import { Knowledge } from './models/index.js';
import { rank } from './helper/match.helper.js';
import { mergeEntry } from './helper/merge.helper.js';
import { RECALL_LIMIT } from './constant/defaults.constant.js';
import { seedIfEmpty } from './seed.js';

let ready = null;

async function connect(uri = env.MONGO_URI, { seed = true } = {}) {
    if (ready) return ready;

    ready = (async () => {
        await mongo.connect(uri);
        await Knowledge.init().catch(() => {});

        if (seed) {
            const count = await seedIfEmpty();
            if (count) logger.info(`[knowledge] seeded ${count} entry`);
        }

        logger.info('📚 [knowledge] ready');
    })();

    return ready;
}

function get(key) {
    return Knowledge.findOne({ key, enabled: true }).lean();
}

function list({ type, tags, limit = 20 } = {}) {
    const query = { enabled: true };
    if (type) query.type = type;
    if (tags?.length) query.tags = { $in: tags };
    return Knowledge.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
}

async function save(entry) {
    if (entry.key) {
        const existing = await Knowledge.findOne({ key: entry.key }).lean();
        const doc = existing ? mergeEntry(existing, entry) : entry;
        return Knowledge.findOneAndUpdate(
            { key: entry.key },
            { $set: doc },
            { new: true, upsert: true },
        ).lean();
    }
    return (await Knowledge.create(entry)).toObject();
}

function remove(key) {
    return Knowledge.deleteOne({ key });
}

async function forQuery({ query, type, tags, limit = RECALL_LIMIT } = {}) {
    const filter = { enabled: true };
    if (type) filter.type = type;

    let docs = [];
    if (query) {
        docs = await Knowledge.find(
            { ...filter, $text: { $search: query } },
            { score: { $meta: 'textScore' } },
        )
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit * 3)
            .lean();
    }

    if (!docs.length) {
        docs = await Knowledge.find(filter)
            .sort({ updatedAt: -1 })
            .limit(limit * 3)
            .lean();
    }

    const ranked = rank(docs, { tags }).slice(0, limit);

    if (ranked.length) {
        const ids = ranked.map((d) => d._id);
        await Knowledge.updateMany(
            { _id: { $in: ids } },
            { $inc: { 'stats.uses': 1 }, $set: { 'stats.lastUsedAt': new Date() } },
        );
    }

    return ranked;
}

export const knowledgeService = {
    connect,
    isReady: mongo.isReady,
    entry: { get, list, save, remove },
    recall: { forQuery },
};
