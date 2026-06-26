#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { logger } from '@mida/logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
    GITLAB_URL = 'https://gitlab.com',
    GITLAB_TOKEN,
    GITLAB_PROJECT_ID,
    SKIP_SYNC,
    WORK_DIR = 'workspace',
} = process.env;

const WORK_DIR_ABS = path.isAbsolute(WORK_DIR) ? WORK_DIR : path.resolve(REPO_ROOT, WORK_DIR);

const c = {
    reset: '\x1b[0m',
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

const up = (n) => `\x1b[${n}A`;
const clearDown = '\x1b[J';

async function fetchAllRepos(groupId) {
    const repos = [];
    let page = 1;

    while (true) {
        const url = new URL(
            `${GITLAB_URL.replace(/\/$/, '')}/api/v4/groups/${encodeURIComponent(groupId)}/projects`,
        );
        url.searchParams.set('per_page', '100');
        url.searchParams.set('page', String(page));
        url.searchParams.set('order_by', 'name');
        url.searchParams.set('sort', 'asc');
        url.searchParams.set('archived', 'false');
        url.searchParams.set('include_subgroups', 'false');

        const res = await fetch(url.toString(), {
            headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN },
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`GitLab API ${res.status}: ${body.slice(0, 300)}`);
        }

        const data = await res.json();
        if (data.length === 0) break;
        repos.push(...data);

        const totalPages = parseInt(res.headers.get('X-Total-Pages') || '1', 10);
        if (page >= totalPages) break;
        page++;
    }

    return repos;
}

const MAX_VISIBLE = Math.max(5, (process.stdout.rows || 24) - 10);

function isCloned(repo) {
    return existsSync(path.join(WORK_DIR_ABS, repo.path, '.git'));
}

function renderList(repos, cursor, selected, offset) {
    const lines = [];

    // Scroll indicator top
    if (offset > 0) {
        lines.push(c.dim(`  ↑ ${offset} more above`));
    }

    const end = Math.min(offset + MAX_VISIBLE, repos.length);

    for (let i = offset; i < end; i++) {
        const repo = repos[i];
        const atCursor = i === cursor;
        const checked = selected.has(i);
        const cloned = isCloned(repo);

        const arrow = atCursor ? c.cyan('▶') : ' ';
        const box = checked ? c.green('✓') : ' ';
        const name = atCursor ? c.bold(c.cyan(repo.name)) : repo.name;
        const branch = repo.default_branch ? c.dim(` ${repo.default_branch}`) : '';
        const tag = cloned ? c.dim(' [cloned]') : '';

        lines.push(`  ${arrow} [${box}] ${name}${branch}${tag}`);
    }

    // Scroll indicator bottom
    if (end < repos.length) {
        lines.push(c.dim(`  ↓ ${repos.length - end} more below`));
    }

    lines.push('');
    lines.push(
        [
            c.dim('↑↓') + ' move',
            c.dim('SPACE') + ' toggle',
            c.dim('A') + ' all/none',
            c.bold('ENTER') + ' clone',
            c.dim('Q') + ' quit',
        ]
            .map((s) => `  ${s}`)
            .join('   '),
    );
    lines.push(`  Selected: ${c.bold(String(selected.size))} / ${repos.length}`);

    return lines;
}

function selectRepos(repos) {
    return new Promise((resolve, reject) => {
        // Non-TTY fallback: auto-select all
        if (!process.stdin.isTTY) {
            resolve(repos);
            return;
        }

        const selected = new Set();
        let cursor = 0;
        let offset = 0;
        let prevHeight = 0;

        function adjustScroll() {
            if (cursor < offset) offset = cursor;
            if (cursor >= offset + MAX_VISIBLE) offset = cursor - MAX_VISIBLE + 1;
        }

        function draw() {
            if (prevHeight > 0) {
                process.stdout.write(up(prevHeight) + clearDown);
            }
            const lines = renderList(repos, cursor, selected, offset);
            process.stdout.write(lines.join('\n') + '\n');
            prevHeight = lines.length;
        }

        function cleanup() {
            try {
                process.stdin.setRawMode(false);
            } catch (e) {
                logger.error(e);
            }
            process.stdin.pause();
            process.stdin.removeListener('data', onKey);
        }

        function onKey(key) {
            switch (key) {
                // Quit
                case '\x03': // Ctrl+C
                case 'q':
                case 'Q':
                    cleanup();
                    process.stdout.write('\n');
                    reject(new Error('Cancelled'));
                    return;

                // Confirm
                case '\r':
                case '\n':
                    cleanup();
                    process.stdout.write('\n');
                    resolve(repos.filter((_, i) => selected.has(i)));
                    return;

                // Toggle selection
                case ' ':
                    if (selected.has(cursor)) selected.delete(cursor);
                    else selected.add(cursor);
                    break;

                // Toggle all
                case 'a':
                case 'A':
                    if (selected.size === repos.length) selected.clear();
                    else repos.forEach((_, i) => selected.add(i));
                    break;

                // Navigation
                case '\x1b[A': // ↑
                    cursor = Math.max(0, cursor - 1);
                    adjustScroll();
                    break;

                case '\x1b[B': // ↓
                    cursor = Math.min(repos.length - 1, cursor + 1);
                    adjustScroll();
                    break;

                case '\x1b[5~': // Page Up
                    cursor = Math.max(0, cursor - MAX_VISIBLE);
                    adjustScroll();
                    break;

                case '\x1b[6~': // Page Down
                    cursor = Math.min(repos.length - 1, cursor + MAX_VISIBLE);
                    adjustScroll();
                    break;

                case '\x1b[H': // Home
                    cursor = 0;
                    adjustScroll();
                    break;

                case '\x1b[F': // End
                    cursor = repos.length - 1;
                    adjustScroll();
                    break;
            }

            draw();
        }

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', onKey);

        draw();
    });
}

async function syncRepo(repo) {
    const repoDir = path.join(WORK_DIR_ABS, repo.path);
    const authedUrl = repo.http_url_to_repo.replace(
        /^https?:\/\//,
        `https://oauth2:${GITLAB_TOKEN}@`,
    );

    const alreadyCloned = isCloned(repo);
    const verb = alreadyCloned ? 'pulling' : 'cloning';
    const icon = alreadyCloned ? c.cyan('↻') : c.cyan('⬇');

    process.stdout.write(`  ${icon} ${c.bold(repo.name)} — ${verb}... `);

    try {
        if (alreadyCloned) {
            execSync('git pull --ff-only', { cwd: repoDir, stdio: 'pipe' });
        } else {
            mkdirSync(path.dirname(repoDir), { recursive: true });
            execSync(`git clone --depth=1 "${authedUrl}" "${repoDir}"`, { stdio: 'pipe' });
        }
        process.stdout.write(c.green('✓') + '\n');
    } catch (err) {
        const stderr = err.stderr?.toString().trim() || err.message;
        process.stdout.write(c.red('✗') + '\n');
        process.stdout.write(c.red(`     ${stderr.split('\n')[0]}\n`));
    }
}

async function main() {
    if (SKIP_SYNC === 'true') {
        console.log(c.dim('Skipping workspace sync\n'));
        process.exit(0);
    }
    if (!GITLAB_TOKEN) {
        console.error(c.red('\n  ✗ GITLAB_TOKEN is not set in .env\n'));
        process.exit(1);
    }
    if (!GITLAB_PROJECT_ID) {
        console.error(c.red('\n  ✗ GITLAB_PROJECT_ID is not set in .env\n'));
        process.exit(1);
    }

    console.log(c.bold('\n  GitLab Workspace Sync'));
    console.log(c.dim(`  Group : ${GITLAB_PROJECT_ID}`));
    console.log(c.dim(`  Target: ${WORK_DIR_ABS}\n`));

    // 1. Fetch repo list
    process.stdout.write('  Fetching repositories...');
    let repos;
    try {
        repos = await fetchAllRepos(GITLAB_PROJECT_ID);
        process.stdout.write(` ${c.green('✓')} ${repos.length} found\n\n`);
    } catch (err) {
        process.stdout.write(` ${c.red('✗')}\n`);
        console.error(c.red(`  ${err.message}\n`));
        process.exit(1);
    }

    if (repos.length === 0) {
        console.log(c.yellow('  No repositories found in this group.\n'));
        return;
    }

    // 2. Interactive selection
    let chosen;
    try {
        chosen = await selectRepos(repos);
    } catch {
        console.log(c.dim('  Cancelled.\n'));
        return;
    }

    if (chosen.length === 0) {
        console.log(c.dim('  Nothing selected — skipping sync.\n'));
        return;
    }

    console.log(c.bold(`\n  Syncing ${chosen.length} repo(s):\n`));
    try {
        mkdirSync(WORK_DIR_ABS, { recursive: true });
    } catch (err) {
        if (err.code === 'EACCES') {
            console.error(c.red(`  ✗ Permission denied: cannot create ${WORK_DIR_ABS}`));
            console.error(
                c.dim(
                    `    Fix: sudo mkdir -p ${WORK_DIR_ABS} && sudo chown $USER:$USER ${WORK_DIR_ABS}`,
                ),
            );
            console.error(c.dim(`    Or set WORK_DIR to a writable path in .env\n`));
            process.exit(1);
        }
        throw err;
    }

    for (const repo of chosen) {
        await syncRepo(repo);
    }

    console.log(c.bold(c.green('\n  ✓ Workspace ready.\n')));
}

main().catch((err) => {
    console.error(c.red(`\n  Fatal: ${err.message}\n`));
    process.exit(1);
});
