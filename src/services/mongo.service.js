import { resolveConn } from './shard-resolver.service.js';
import { assertCollection, assertSafePipeline } from '../helpers/validate.helper.js';

const HARD_LIMIT = 200;

export const mongoService = {
    async find({ db, collection, filter = {}, projection = {}, sort = {}, limit = 50, domain }) {
        assertCollection(db, collection);
        const conn = await resolveConn(db, domain);
        // Lazy model — dùng raw collection access để tránh schema mismatch với generic find
        const col = conn.collection(collection);
        const docs = await col
            .find(filter, { projection })
            .sort(sort)
            .limit(Math.min(limit, HARD_LIMIT))
            .maxTimeMS(10000)
            .toArray();
        return docs;
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
        const exact = Object.keys(filter).length > 0;
        return exact
            ? col.countDocuments(filter, { maxTimeMS: 10000 })
            : col.estimatedDocumentCount({ maxTimeMS: 5000 });
    },
};
