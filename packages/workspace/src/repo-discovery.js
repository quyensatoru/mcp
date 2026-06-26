import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

// Returns absolute paths of all git repositories directly under baseDir.
// A directory is treated as a repo if it contains a .git entry.
export function discoverRepos(baseDir) {
    if (!existsSync(baseDir)) return [];

    return readdirSync(baseDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(baseDir, entry.name))
        .filter((dir) => existsSync(path.join(dir, '.git')));
}
