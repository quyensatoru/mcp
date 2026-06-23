import { getConnections } from '../config/db.config.js';
import { cacheKey, withCache } from '../helpers/redis.helper.js';
import mongoose from 'mongoose';

const proxySchema = new mongoose.Schema(
    { domain: String, proxy: Number },
    { versionKey: false, timestamps: true },
);

function getProxyModel(conn) {
    return conn.models['shops'] ?? conn.model('shops', proxySchema);
}

export async function resolveShardNum(domain) {
    if (!domain) return 1;
    const conns = getConnections();
    if (!conns.Proxy) return 1;

    const key = cacheKey('shard', { domain });
    return withCache(key, 3600, async () => {
        const ProxyModel = getProxyModel(conns.Proxy);
        const doc = await ProxyModel.findOne({ domain }).lean().exec();
        return doc?.proxy ?? 1;
    });
}

export async function getShardConns(domain) {
    const conns = getConnections();
    const n = await resolveShardNum(domain);
    return {
        api: n === 2 ? conns.ApiV2 : conns.ApiV1,
        heatmap: n === 2 ? conns.HeatmapV2 : conns.HeatmapV1,
        recorder: n === 2 ? conns.RecorderV2 : conns.RecorderV1,
        shardNum: n,
    };
}

export function getModel(conn, name, schema) {
    if (!conn) throw new Error(`DB connection unavailable for model "${name}"`);
    return conn.models[name] ?? conn.model(name, schema);
}

// Lấy connection theo tên db (api|heatmap|recorder) và domain (optional)
export async function resolveConn(db, domain) {
    const conns = getConnections();
    if (db === 'proxy') return conns.Proxy;
    const n = domain ? await resolveShardNum(domain) : 1;
    const map = {
        api: n === 2 ? conns.ApiV2 : conns.ApiV1,
        heatmap: n === 2 ? conns.HeatmapV2 : conns.HeatmapV1,
        recorder: n === 2 ? conns.RecorderV2 : conns.RecorderV1,
    };
    const conn = map[db];
    if (!conn) throw new Error(`Connection "${db}" (shard ${n}) chưa được cấu hình`);
    return conn;
}
