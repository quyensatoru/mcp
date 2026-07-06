import jwt from 'jsonwebtoken';
import { env } from '../config/env.config.js';
import { logger } from '@mida/logger';

export function authMiddleware(req, res, next) {
    if (env.MCP_TRANSPORT === 'stdio') return next();

    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Bearer token' });
    }

    try {
        req.user = jwt.verify(auth.slice(7), env.JWT_SECRET);
        return next();
    } catch (err) {
        logger.warn({ err }, 'JWT verification failed');
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
