import 'dotenv/config';
import { signToken } from '../src/middleware/auth.middleware.js';

const sub = process.argv[2] || 'claude-desktop';
const expiresIn = process.argv[3] || '30d';

const token = signToken({ sub, scope: 'mcp' }, expiresIn);

console.log(token);
