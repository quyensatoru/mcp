import mongoose from 'mongoose';
import { Db } from '../config/db.config.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';

const ProxySchema = new mongoose.Schema(
    { domain: String, proxy: Number },
    { collection: 'shops', versionKey: false },
);

const ProxyModel = Db.Proxy.model('Proxy', ProxySchema);

// domain → shard number (1 | 2). Cache 1h vì mapping gần như tĩnh.
export async function resolveProxy(domain) {
    if (!domain) return 1;
    return withCache(cacheKey('proxy', { domain }), 3600, async () => {
        const doc = await ProxyModel.findOne({ domain }, { proxy: 1 }).lean().exec();
        return doc?.proxy ?? 1;
    });
}
