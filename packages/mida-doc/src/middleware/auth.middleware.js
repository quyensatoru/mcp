import jwt from 'jsonwebtoken';
import { env } from '../config/env.config.js';
import { logger } from '@mida/logger';

export function authMiddleware(req, res, next) {
    if (env.MCP_TRANSPORT === 'stdio') return next();

    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Bearer token' });
    }

    const token = auth.slice(7);
    try {
        req.user = jwt.verify(token, env.JWT_SECRET);
        next();
    } catch (err) {
        logger.warn({ err }, 'JWT verification failed');
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export function signToken(payload, expiresIn = '7d') {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}
