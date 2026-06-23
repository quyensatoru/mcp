import { logger } from '@mida/logger';
import { MattermostClient, env as MattermostEnv } from '@mida/mattermost';
import { WebSocket } from 'ws';
let _client;

export const connectMattermost = () => {
    if (_client) return client;

    const client = new MattermostClient();

    logger.info(MattermostEnv.MATTERMOST_TOKEN);
    const ws = new WebSocket(
        MattermostEnv.MATTERMOST_URL.replace(/\/$/, '').replace(/^https:/, 'wss:') +
            '/api/v4/websocket',
        {
            headers: {
                Authorization: `Bearer ${MattermostEnv.MATTERMOST_TOKEN}`,
            },
        },
    );

    ws.addEventListener('open', (e) => {
        logger.info('Opened socket mattermost: ');
    });

    ws.addEventListener('error', (error) => {
        logger.error('Error: ' + `type: ${error.target.url} ` + `message: ${error.message}`);
    });

    ws.addEventListener('close', (e) => {
        logger.info('Closed mattermost');
    });

    ws.addEventListener('message', (e) => {
        logger.info(e.data);
    });

    _client = client;
};
