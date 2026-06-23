import { env } from './config/env.config.js';
import express from 'express';
import { logger } from '@mida/logger';
import { connectDB } from './config/mongo.config.js';
import { connectMattermost } from './channel/mattermost.channel.js';
import { handleEvent } from './claude/mattermost.claude.js';

const bootstrap = () => {
    const app = express();

    connectDB();
    connectMattermost(handleEvent);

    app.listen(env.PORT, () => {
        logger.info(`App listening at http://localhost:${env.PORT}`);
    });
};

bootstrap();
