import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { logger } from '@mida/logger';
import { bearerAuth } from './auth.js';
import { configRouter } from './routes/config.routes.js';
import { sessionsRouter } from './routes/sessions.routes.js';
import { filesRouter } from './routes/files.routes.js';
import { gitRouter } from './routes/git.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, '../../web/dist');

export function createApp(configService, { token } = {}) {
    const app = express();
    app.use(express.json({ limit: '4mb' }));

    app.get('/api/health', (_req, res) => res.json({ ok: true, ready: configService.isReady() }));

    const auth = bearerAuth(token);
    app.use('/api/config', auth, configRouter(configService));
    app.use('/api/sessions', auth, sessionsRouter());
    app.use('/api/files', auth, filesRouter());
    app.use('/api/git', auth, gitRouter());

    // Serve the built dashboard + SPA fallback for client-side routes.
    if (existsSync(WEB_DIST)) {
        app.use(express.static(WEB_DIST));
        app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
    } else {
        logger.warn(`[console] web/dist not found at ${WEB_DIST} — run the dashboard build`);
    }

    return app;
}
