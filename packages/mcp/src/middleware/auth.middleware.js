import jwt from 'jsonwebtoken';
import { env } from '../config/env.config.js';
import { logger } from '@mida/logger';

// Verify JWT Bearer token, gắn payload vào req.user
export function authMiddleware(req, res, next) {
    // stdio transport — bỏ qua auth
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

// Tạo token (dùng để issue cho client)
export function signToken(payload, expiresIn = '7d') {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}
