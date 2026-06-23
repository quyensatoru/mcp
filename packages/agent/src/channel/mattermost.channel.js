import { logger } from '@mida/logger';
import { MattermostClient, env as MattermostEnv } from '@mida/mattermost';
import { WebSocket } from 'ws';
let _client;

export const connectMattermost = (callback) => {
    if (_client) return _client;

    const client = new MattermostClient({ url: MattermostEnv.MATTERMOST_URL, token: MattermostEnv.MATTERMOST_TOKEN });

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

    ws.addEventListener('message', async (e) => {
        typeof callback === "function" && await callback(_client, e)
    });

    _client = client;
};
