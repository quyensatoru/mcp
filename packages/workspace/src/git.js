import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function git(args, cwd) {
    const { stdout } = await execFileAsync('git', args, { cwd });
    return stdout.trim();
}

export async function fetch(repoDir, remote = 'origin') {
    await git(['fetch', remote], repoDir);
}

export async function checkoutBranch(repoDir, branch) {
    await git(['checkout', branch], repoDir);
}

export async function getStatus(repoDir) {
    const out = await git(['status', '--porcelain'], repoDir);
    return out
        .split('\n')
        .filter(Boolean)
        .map((line) => ({ x: line[0], y: line[1], path: line.slice(3) }));
}


export async function pull(repoDir, remote = 'origin', branch = 'main') {
    await git(['pull', remote, branch], repoDir);
}

export async function getCurrentBranch(repoDir) {
    return git(['rev-parse', '--abbrev-ref', 'HEAD'], repoDir);
}

export async function branchExists(repoDir, branch) {
    try {
        await git(['rev-parse', '--verify', `refs/heads/${branch}`], repoDir);
        return true;
    } catch {
        return false;
    }
}

export async function worktreeExists(repoDir, worktreePath) {
    const list = await git(['worktree', 'list', '--porcelain'], repoDir);
    return list.split('\n').some((line) => line === `worktree ${worktreePath}`);
}

export async function addWorktree(repoDir, worktreePath, branch) {
    await git(['worktree', 'add', '-b', branch, worktreePath, 'HEAD'], repoDir);
}

export async function addWorktreeExistingBranch(repoDir, worktreePath, branch) {
    await git(['worktree', 'add', worktreePath, branch], repoDir);
}

export async function removeWorktree(repoDir, worktreePath) {
    await git(['worktree', 'remove', '--force', worktreePath], repoDir);
}

export async function pruneWorktrees(repoDir) {
    await git(['worktree', 'prune'], repoDir);
}

export async function deleteBranch(repoDir, branch) {
    await git(['branch', '-D', branch], repoDir);
}
