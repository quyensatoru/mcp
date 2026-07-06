import mongoose from 'mongoose';
import { logger } from '@mida/logger';

let ready = false;

async function connect(uri) {
    if (ready) return;
    await mongoose.connect(uri, { maxPoolSize: 5, autoIndex: true });
    ready = true;
}

function watch(onChange) {
    try {
        const stream = mongoose.connection.watch([], { fullDocument: 'updateLookup' });
        stream.on('change', onChange);
        stream.on('error', (e) => logger.warn('[knowledge] change stream error: ' + e.message));
    } catch (e) {
        logger.warn('[knowledge] change stream unavailable: ' + e.message);
    }
}

function getConnection() {
    return mongoose.connection;
}

function isReady() {
    return ready;
}

export const mongo = { connect, watch, getConnection, isReady };
