import { env } from './config/env.config.js';
import { McpTarget } from './models/index.js';
import { KIND_TEMPLATES } from './constant/defaults.constant.js';

export async function seedTargets() {
    const kinds = {
        mongo: env.MONGO_TARGETS,
        rabbit: env.RABBIT_TARGETS,
        redis: env.REDIS_TARGETS,
    };

    let count = 0;
    for (const [kind, list] of Object.entries(kinds)) {
        const tpl = KIND_TEMPLATES[kind];
        for (const [index, item] of list.entries()) {
            const name = `${kind}-${item.cluster}`;
            await McpTarget.updateOne(
                { name },
                {
                    $set: {
                        command: item.command ?? tpl.command,
                        args: item.args ?? tpl.args,
                    },
                    $setOnInsert: {
                        name,
                        kind,
                        cluster: item.cluster,
                        capability: item.capability ?? 'read',
                        order: index,
                        enabled: true,
                    },
                },
                { upsert: true },
            );
            count++;
        }
    }
    return count;
}
