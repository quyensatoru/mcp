import mongoose from 'mongoose';
import { env } from './env.config.js';
import { logger } from '@mida/logger';

const BASE_OPTS = {
    heartbeatFrequencyMS: 10000,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
};
const HM_OPTS = { ...BASE_OPTS, ignoreUndefined: true, socketTimeoutMS: 7200000 };

function connect(uri, opts, name) {
    const conn = mongoose.createConnection(uri, opts);
    conn.on('connected', () => logger.info(`MongoDB [${name}] connected`));
    conn.on('error', (err) => logger.warn({ err }, `MongoDB [${name}] error`));
    return conn;
}

export const Db = {
    Proxy: connect(env.PROXY_URI, BASE_OPTS, 'Proxy'),
    ApiV1: connect(env.API_URI_1, BASE_OPTS, 'ApiV1'),
    ApiV2: connect(env.API_URI_2, BASE_OPTS, 'ApiV2'),
    HeatmapV1: connect(env.HM_URI_1, HM_OPTS, 'HeatmapV1'),
    HeatmapV2: connect(env.HM_URI_2, HM_OPTS, 'HeatmapV2'),
    RecorderV1: connect(env.RECORDER_URI_1, BASE_OPTS, 'RecorderV1'),
    RecorderV2: connect(env.RECORDER_URI_2, BASE_OPTS, 'RecorderV2'),
};

export const dbReady = () => Promise.all(Object.values(Db).map((conn) => conn.asPromise()));
