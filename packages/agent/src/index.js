import { env } from './config/env.config.js';
import express from 'express';
import { logger } from '@mida/logger';
import { connectDB } from './config/mongo.config.js';
import { configService } from '@mida/console';
import { connectMattermost } from './channel/mattermost.channel.js';
import { handleEvent } from './claude/mattermost.claude.js';

const bootstrap = async () => {
    const app = express();

    connectDB();

    if (env.MONGO_URI) {
        try {
            // Load dynamic config (seed-from-env on first boot) before serving traffic.
            await configService.connect(env.MONGO_URI);
        } catch (err) {
            logger.error('[config] ConfigService connect failed: ' + err.message);
        }
    } else {
        logger.warn('[config] MONGO_URI not set — dynamic config unavailable');
    }

    connectMattermost(handleEvent);

    app.listen(env.PORT, () => {
        logger.info(`App listening at http://localhost:${env.PORT}`);
    });
};

bootstrap();
