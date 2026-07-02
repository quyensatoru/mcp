import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { logger } from '@mida/logger';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export function resolveClaudeBin() {
    if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;

    const pkg = `claude-agent-sdk-${process.platform}-${process.arch}`;
    const bin = process.platform === 'win32' ? 'claude.exe' : 'claude';

    const candidates = [];
    const pnpmDir = path.join(REPO_ROOT, 'node_modules/.pnpm');
    try {
        const dirs = readdirSync(pnpmDir)
            .filter((d) => d.startsWith(`@anthropic-ai+${pkg}@`))
            .sort();

        const latest = dirs.at(-1);
        if (latest) {
            candidates.push(path.join(pnpmDir, latest, 'node_modules/@anthropic-ai', pkg, bin));
        }
    } catch {
        /* no .pnpm dir */
    }
    candidates.push(path.join(REPO_ROOT, 'node_modules/@anthropic-ai', pkg, bin));

    const found = candidates.find((p) => existsSync(p));
    if (!found) {
        logger.warn(
            `[claude-config] Claude native binary for ${process.platform}-${process.arch} not found; ` +
                'set CLAUDE_BIN to override or let the SDK auto-resolve',
        );
    }
    return found;
}
