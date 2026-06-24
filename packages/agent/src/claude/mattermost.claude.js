import { logger } from '@mida/logger';
import { createClaudeAgent } from '../config/claude.config.js';
import { sessionStorageModel } from '../schema/session-storage.schema.js';

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

    const rootId = post.root_id || post.id;

    const session = await sessionStorageModel.findOne({
        threadId: rootId,
        channelId: post.channel_id
    })

    if (!botUserId) botUserId = (await client.getMe()).id;
    if (post.user_id === botUserId) return;
    if (!post.message.includes("@bssc_sa_th_agent_bot") && !session) return;

    const reply = await client.createPost(post.channel_id, '...', { rootId });
    const updater = makeStreamUpdater(client, reply.id);
    

    try {
        const message = post.message.replaceAll("@bssc_sa_th_agent_bot", "")
        const { query: stream } = createClaudeAgent(message, session?.sessionId || "");

        for await (const event of stream) {
            console.log(event);
            if (event.type === "system") {
                await sessionStorageModel.findOneAndUpdate({
                    sessionId: event.session_id,
                }, {
                    threadId: rootId,
                    channelId: post.channel_id
                }, {
                    upsert: true
                })
            }

            if (event.type !== 'assistant') continue;

            for (const block of event.message?.content ?? []) {
                switch(block.type) {
                    case "text":
                        updater.append(block.text);
                        break;
                    case "tool_use": {
                        const name = block.name.slice(0, 30)
                        updater.append(`\n_🔧 ${name}..._\n`);
                        break;
                    }
                    default: 
                        break;
                }
            }
        }

        await updater.done();
    } catch (err) {
        logger.error('handleEvent error: ' + err.message);
        await updater.done(updater.text + `\n\n❌ ${err.message}`);
    }
};
