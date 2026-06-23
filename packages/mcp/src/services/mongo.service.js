import { resolveConn } from './shard-resolver.service.js';
import { assertCollection, assertSafePipeline } from '../helpers/validate.helper.js';
import { logger } from '@mida/logger';

const HARD_LIMIT = 200;
'aba'.toLowerCase;
export const mongoService = {
    async find({ db, collection, filter = {}, projection = {}, sort = {}, limit = 50, domain }) {
        assertCollection(db, collection);
        const conn = await resolveConn(db, domain);
        const col = conn.collection(collection);
        if (collection.toLowerCase() != 'shops') {
            const shop = await conn.collection('shops').findOne({ domain: domain });
            if (!shop) {
                throw new Error(`Shop not found: ${domain}`);
            }

            filter = {
                ...filter,
                shop: shop._id,
            };
        }
        const docs = await col
            .find(filter, { projection })
            .sort(sort)
            .limit(Math.min(limit, HARD_LIMIT))
            .maxTimeMS(10000)
            .toArray();
        return docs;
    },

    async getFields({ db, collection, domain, sampleSize = 20 }) {
        assertCollection(db, collection);
        const conn = await resolveConn(db, domain);
        const col = conn.collection(collection);
        const doc = await col.findOne({});
        return Object.keys(doc);
    },

    async aggregate({ db, collection, pipeline, domain }) {
        assertCollection(db, collection);
        assertSafePipeline(pipeline);
        const conn = await resolveConn(db, domain);
        const col = conn.collection(collection);
        return col.aggregate(pipeline, { maxTimeMS: 15000 }).toArray();
    },

    async count({ db, collection, filter = {}, domain }) {
        assertCollection(db, collection);
        const conn = await resolveConn(db, domain);
        const col = conn.collection(collection);
        if (collection.toLowerCase() != 'shops') {
            const shop = await conn.collection('shops').findOne({ domain: domain });
            if (!shop) {
                throw new Error(`Shop not found: ${domain}`);
            }

            filter = {
                ...filter,
                shop: shop._id,
            };
        }
        const exact = Object.keys(filter).length > 0;
        return exact
            ? col.countDocuments(filter, { maxTimeMS: 10000 })
            : col.estimatedDocumentCount({ maxTimeMS: 5000 });
    },
};
