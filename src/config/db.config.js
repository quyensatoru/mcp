import mongoose from 'mongoose';
import { env } from './env.config.js';
import { logger } from '../helpers/logger.js';

const BASE_OPTS = {
    heartbeatFrequencyMS: 10000,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
};
const HM_OPTS = { ...BASE_OPTS, ignoreUndefined: true, socketTimeoutMS: 7200000 };

function makeConn(uri, opts, name) {
    if (!uri) return null;
    const conn = mongoose.createConnection(uri, opts);
    conn.on('connected', () => logger.info(`MongoDB [${name}] connected`));
    conn.on('error', (err) => logger.warn({ err }, `MongoDB [${name}] error`));
    return conn;
}

let _conns = null;

export function getConnections() {
    if (_conns) return _conns;
    _conns = {
        Proxy: makeConn(env.PROXY_URI, BASE_OPTS, 'Proxy'),
        ApiV1: makeConn(env.API_URI_1, BASE_OPTS, 'ApiV1'),
        ApiV2: makeConn(env.API_URI_2, BASE_OPTS, 'ApiV2'),
        HeatmapV1: makeConn(env.HM_URI_1, HM_OPTS, 'HeatmapV1'),
        HeatmapV2: makeConn(env.HM_URI_2, HM_OPTS, 'HeatmapV2'),
        RecorderV1: makeConn(env.RECORDER_URI_1, BASE_OPTS, 'RecorderV1'),
        RecorderV2: makeConn(env.RECORDER_URI_2, BASE_OPTS, 'RecorderV2'),
    };
    return _conns;
}
