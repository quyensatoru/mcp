import { logger } from '@mida/logger';
import { createClaudeAgent } from '../config/claude.config.js';
import { sessionStorageModel } from '../schema/session-storage.schema.js';
import { MATTERMOST_LOADING } from '../constants/cdn.constants.js';

let botUserId = null;

const pendingPermissions = new Map();

const READ_ONLY =
    /\b(get|list|search|find|fetch|read|view|query|retrieve|describe|show|count|stat|info|ping|whoami|preview|check|download)\b/i;

function makeStreamUpdater(client, postId, loading) {
    let buffer = [];
    let flushed = [];
    let timer = null;

    const flush = async () => {
        if (buffer.length === flushed.length) return;
        flushed = buffer;
        await client
            .updatePost(postId, buffer.join('\n'))
            .catch((err) => logger.warn('Mattermost updatePost:', err.message));
    };

    return {
        append(chunk) {
            buffer.push(chunk);
            if (!timer)
                timer = setTimeout(() => {
                    timer = null;
                    flush();
                }, 600);
        },
        stripLoading() {
            if (loading) buffer = buffer.filter((b) => !b.includes(loading));
        },
        get text() {
            return buffer;
        },
        async done(finalText) {
            clearTimeout(timer);
            timer = null;
            if (finalText !== undefined) buffer = finalText;
            await flush();
        },
    };
}

function buildCanUseTool(client, channelId, rootId) {
    return async (toolName, input, options) => {
        if (!toolName.startsWith('mcp__')) {
            return { behavior: 'allow', updatedInput: input };
        }

        // pypass read only tool
        const localName = toolName.split('__').pop() ?? '';
        if (READ_ONLY.test(localName)) {
            return { behavior: 'allow', updatedInput: input };
        }

        const key = `${channelId}:${rootId}`;
        const toolUseID = options?.toolUseID;
        logger.log(
            '[TOOL] ' +
                toolName +
                ' => waiting approval | key:' +
                key +
                ' | toolUseID:' +
                toolUseID,
        );

        const desc = options?.description ? `\n_${options.description}_` : '';
        const inputPreview = JSON.stringify(input, null, 2).slice(0, 500);

        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                const queue = pendingPermissions.get(key);

                if (queue) {
                    const idx = queue.findIndex((p) => p.resolve === resolve);

                    if (idx !== -1) {
                        queue.splice(idx, 1);
                    }

                    if (queue.length === 0) {
                        pendingPermissions.delete(key);
                    }
                }

                resolve({ behavior: 'deny', message: 'Timeout: không có phản hồi trong 120s' });
            }, 120_000);

            const queue = pendingPermissions.get(key) ?? [];

            queue.push({ resolve, timer, toolUseID, toolName, input });
            pendingPermissions.set(key, queue);

            client
                .createPost(
                    channelId,
                    [
                        `⚠️ **Xác nhận thực thi**`,
                        ``,
                        `**Tool:** \`${toolName}\`${desc}`,
                        `\`\`\`json`,
                        inputPreview,
                        `\`\`\``,
                        `Reply **yes** để cho phép hoặc **no** để từ chối _(tự động từ chối sau 120s)_`,
                    ].join('\n'),
                    { rootId },
                )
                .catch((err) => {
                    logger.warn('[canUseTool] Failed to send approval post: ' + err.message);
                    const q = pendingPermissions.get(key);

                    if (q) {
                        const idx = q.findIndex((p) => p.resolve === resolve);

                        if (idx !== -1) {
                            q.splice(idx, 1);
                        }

                        if (q.length === 0) {
                            pendingPermissions.delete(key);
                        }
                    }
                    clearTimeout(timer);

                    resolve({
                        behavior: 'deny',
                        message: `Không thể gửi yêu cầu xác nhận: ${err.message}`,
                    });
                });
        });
    };
}

export const handleEvent = async (client, e) => {
    let message;
    try {
        message = JSON.parse(e.data);
    } catch {
        return;
    }

    if (message.event !== 'posted') return;

    const post = JSON.parse(message.data.post);
    const rootId = post.root_id || post.id;

    const session = await sessionStorageModel.findOne({
        threadId: rootId,
        channelId: post.channel_id,
    });

    if (!botUserId) botUserId = (await client.getMe()).id;
    if (post.user_id === botUserId) return;

    const permKey = `${post.channel_id}:${rootId}`;
    const permQueue = pendingPermissions.get(permKey);

    console.log('[PERM] check key:', permKey, '| queue length:', permQueue?.length ?? 0);

    if (permQueue?.length > 0) {
        const pending = permQueue.shift();
        if (permQueue.length === 0) pendingPermissions.delete(permKey);

        clearTimeout(pending.timer);

        const lower = post.message.toLowerCase().trim();
        const allow = /^(yes|y|ok|có|co|✅|1)(\s|$)/i.test(lower);

        console.log(
            '[PERM] resolving tool:',
            pending.toolName,
            '| toolUseID:',
            pending.toolUseID,
            '| allow:',
            allow,
            `| remaining queue: ${permQueue.length}`,
        );

        pending.resolve(
            allow
                ? { behavior: 'allow', updatedInput: pending.input, toolUseID: pending.toolUseID }
                : { behavior: 'deny', message: 'Người dùng từ chối thực thi' },
        );

        await client.createPost(
            post.channel_id,
            allow
                ? '✅ Đã cho phép. Agent tiếp tục thực thi...'
                : '❌ Đã từ chối. Agent dừng thực thi.',
            { rootId },
        );

        return;
    }

    if (!post.message.includes('@bssc_sa_th_agent_bot') && !session) return;

    const reply = await client.createPost(post.channel_id, MATTERMOST_LOADING, { rootId });
    const updater = makeStreamUpdater(client, reply.id, MATTERMOST_LOADING);
    const canUseTool = buildCanUseTool(client, post.channel_id, rootId);

    try {
        const message = post.message.replaceAll('@bssc_sa_th_agent_bot', '');
        const { query: stream } = createClaudeAgent(message, session?.sessionId || '', {
            canUseTool,
        });

        for await (const event of stream) {
            if (event.type === 'system' && event.subtype === 'init') {
                await sessionStorageModel.findOneAndUpdate(
                    {
                        sessionId: event.session_id,
                    },
                    {
                        threadId: rootId,
                        channelId: post.channel_id,
                    },
                    {
                        upsert: true,
                    },
                );
                continue;
            }

            if (event.type === 'result') {
                if (!event.is_error && event.total_cost_usd) {
                    const cost = event.total_cost_usd.toFixed(4);
                    updater.append(`\n\n---\n💰 $${cost} | ${event.num_turns} turns`);
                }
                continue;
            }

            if (event.type === 'tool_use_summary') {
                updater.append(`\n> 📋 ${event.summary.slice(0, 100)}\n`);
                continue;
            }

            if (event.type !== 'assistant') continue;

            for (const block of event.message?.content ?? []) {
                switch (block.type) {
                    case 'text':
                        updater.stripLoading();
                        updater.append(block.text);
                        break;
                    case 'tool_use': {
                        updater.stripLoading();
                        const name = block.name;
                        const stringInput = JSON.stringify(block.input || '{}', null, 2);
                        updater.append(`\n>🔧 ${name}\n>\`\`\`json\n${stringInput}\n\`\`\``);
                        break;
                    }
                    case 'thinking':
                        updater.append(`\n>💭 ${MATTERMOST_LOADING}\n`);
                        break;
                    case 'redacted_thinking':
                        updater.append(`\n>🔒 ${MATTERMOST_LOADING}\n`);
                        break;
                    default:
                        break;
                }
            }
        }

        await updater.done();
    } catch (err) {
        logger.error('handleEvent error: ' + err.message);
        updater.append(`\n\n❌ ${err.message}`);
        await updater.done();
    }
};
