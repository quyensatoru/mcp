// Bearer-token guard for /api/*. When no token is configured the API is open
// (dev convenience) — index.js logs a warning in that case.
export function bearerAuth(token) {
    return (req, res, next) => {
        if (!token) return next();
        const header = req.headers.authorization || '';
        const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
        if (provided && provided === token) return next();
        res.status(401).json({ error: 'Unauthorized — missing or invalid bearer token' });
    };
}
