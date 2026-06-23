import { logger } from '@mida/logger';
import { createClaudeAgent } from '../config/claude.config.js';

let botUserId = null;

function makeStreamUpdater(client, postId) {
    let buffer = '';
    let flushed = '';
    let timer = null;

    const flush = async () => {
        if (buffer === flushed) return;
        flushed = buffer;
        await client.updatePost(postId, buffer).catch((err) => logger.warn('updatePost:', err.message));
    };

    return {
        append(chunk) {
            buffer += chunk;
            if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 600);
        },
        get text() { return buffer; },
        async done(finalText) {
            clearTimeout(timer);
            timer = null;
            if (finalText !== undefined) buffer = finalText;
            await flush();
        },
    };
}

export const handleEvent = async (client, e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.event !== 'posted') return;

    const post = JSON.parse(msg.data.post);

    if (!botUserId) botUserId = (await client.getMe()).id;
    if (post.user_id === botUserId) return;
    if (!post.message.includes("@bssc_sa_th_agent_bot")) return;

    const rootId = post.root_id || post.id;
    const reply = await client.createPost(post.channel_id, '...', { rootId });
    const updater = makeStreamUpdater(client, reply.id);

    try {
        const { query: stream } = createClaudeAgent(post.message, post.channel_id);

        for await (const event of stream) {
            if (event.type !== 'assistant') continue;

            for (const block of event.message?.content ?? []) {
                console.log(block)
                if (block.type === 'text') {
                    updater.append(block.text);
                } else if (block.type === 'tool_use') {
                    updater.append(`\n_🔧 ${block.name.slice(30)}..._\n`);
                }
            }
        }

        await updater.done();
    } catch (err) {
        logger.error('handleEvent error: ' + err.message);
        await updater.done(updater.text + `\n\n❌ ${err.message}`);
    }
};
