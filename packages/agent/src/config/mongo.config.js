import mongoose from 'mongoose';
import { env } from './env.config.js';
import { logger } from '@mida/logger';

export const connectDB = async () => {
    try {
        mongoose.set('strictQuery', false);
        mongoose.connect(env.MONGO_URI, {
            autoIndex: false,
            maxPoolSize: 150,
            minPoolSize: 10,
        });

        logger.info('🚀 MongoDB - Connected 🚀');
    } catch (error) {
        logger.error(`Error: ${error.toString()}`);
    }
};
