export { MattermostClient } from './client.js';
export { env } from './config/env.config.js';

import { MattermostClient } from './client.js';
import { env } from './config/env.config.js';

/**
 * Singleton client pre-configured from environment variables.
 *
 * Bot token (MATTERMOST_TOKEN) is used when present.
 * Falls back to MATTERMOST_USERNAME + MATTERMOST_PASSWORD login.
 *
 * Usage:
 *   import { mattermost } from '@mida/mattermost';
 *   await mattermost.ready;   // wait for login if needed
 *   await mattermost.createPost(channelId, 'Hello!');
 */
class MattermostSingleton extends MattermostClient {
    constructor() {
        super({ url: env.MATTERMOST_URL, token: env.MATTERMOST_TOKEN });

        if (env.MATTERMOST_TOKEN) {
            this.ready = Promise.resolve(this);
        } else if (env.MATTERMOST_USERNAME && env.MATTERMOST_PASSWORD) {
            this.ready = this.login(env.MATTERMOST_USERNAME, env.MATTERMOST_PASSWORD).then(
                () => this,
            );
        } else {
            this.ready = Promise.resolve(this);
        }
    }
}

export const mattermost = new MattermostSingleton();
