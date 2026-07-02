import mongoose from 'mongoose';
import { logger } from '@mida/logger';

let ready = false;

async function connect(uri) {
    if (ready) return;
    await mongoose.connect(uri, { maxPoolSize: 5, autoIndex: true });
    ready = true;
}

// Mongo standalone has no replica set, so change streams aren't available —
// callers fall back to the TTL cache in that case.
function watch(onChange) {
    try {
        const stream = mongoose.connection.watch([], { fullDocument: 'updateLookup' });
        stream.on('change', onChange);
        stream.on('error', (e) =>
            logger.warn('[claude-config] change stream error, falling back to TTL: ' + e.message),
        );
        logger.info('[claude-config] hot-reload via change stream enabled');
    } catch (e) {
        logger.warn(
            '[claude-config] change stream unavailable (no replica set?), TTL cache only: ' +
                e.message,
        );
    }
}

function getConnection() {
    return mongoose.connection;
}

function isReady() {
    return ready;
}

export const mongo = { connect, watch, getConnection, isReady };
