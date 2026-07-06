import { Knowledge } from './models/index.js';

const SAMPLES = [
    {
        type: 'note',
        key: 'about-knowledge',
        title: 'Knowledge MCP là gì',
        tags: ['meta'],
        body: 'Kho tri thức dùng chung. Dùng get_knowledge để tái dùng playbook/debug-workflow đã lưu, save_knowledge để chốt lại tri thức mới. Logic sinh tri thức nằm ở mida-skills.',
        source: 'manual',
    },
];

export async function seedIfEmpty() {
    const count = await Knowledge.estimatedDocumentCount();
    if (count) return 0;
    await Knowledge.insertMany(SAMPLES);
    return SAMPLES.length;
}
