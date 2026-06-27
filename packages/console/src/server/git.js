import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function git(args, cwd) {
    const { stdout } = await execFileAsync('git', args, {
        cwd,
        maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
}

export async function currentBranch(cwd) {
    try {
        return (await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)).trim();
    } catch {
        return null;
    }
}

// Parse `git status --porcelain` into [{ x, y, path }] entries.
export async function status(cwd) {
    const out = await git(['status', '--porcelain'], cwd);
    return out
        .split('\n')
        .filter(Boolean)
        .map((line) => ({ x: line[0], y: line[1], path: line.slice(3) }));
}
