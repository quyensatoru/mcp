import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function git(args, cwd) {
    const { stdout } = await execFileAsync('git', args, { cwd });
    return stdout.trim();
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

// Returns true if a worktree is checked out at the given absolute path.
export async function worktreeExists(repoDir, worktreePath) {
    const list = await git(['worktree', 'list', '--porcelain'], repoDir);
    // Each worktree block starts with "worktree <path>"
    return list.split('\n').some((line) => line === `worktree ${worktreePath}`);
}

// Create a new branch from HEAD and add it as a worktree at worktreePath.
export async function addWorktree(repoDir, worktreePath, branch) {
    await git(['worktree', 'add', '-b', branch, worktreePath, 'HEAD'], repoDir);
}

// Add a worktree for an already-existing branch (resume scenario).
export async function addWorktreeExistingBranch(repoDir, worktreePath, branch) {
    await git(['worktree', 'add', worktreePath, branch], repoDir);
}

// Force-remove the worktree at worktreePath. Safe to call on a missing path.
export async function removeWorktree(repoDir, worktreePath) {
    await git(['worktree', 'remove', '--force', worktreePath], repoDir);
}

// Prune stale worktree admin files (safe to call any time).
export async function pruneWorktrees(repoDir) {
    await git(['worktree', 'prune'], repoDir);
}

// Force-delete a local branch. No-op if branch doesn't exist.
export async function deleteBranch(repoDir, branch) {
    await git(['branch', '-D', branch], repoDir);
}
