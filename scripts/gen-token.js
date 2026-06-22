import 'dotenv/config';
import { signToken } from '../src/middleware/auth.middleware.js';

// Sinh JWT Bearer token để client (Claude Desktop / curl) gọi /mcp.
// Dùng: node scripts/gen-token.js [subject] [expiresIn]
//   node scripts/gen-token.js claude-desktop 30d
const sub = process.argv[2] || 'claude-desktop';
const expiresIn = process.argv[3] || '30d';

const token = signToken({ sub, scope: 'mcp' }, expiresIn);

console.log(token);
