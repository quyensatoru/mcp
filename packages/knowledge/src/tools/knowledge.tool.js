import { z } from 'zod';
import { knowledgeService } from '../config.js';
import { textContent } from '../helper/format.helper.js';
import { wrap } from '../helper/tool.helper.js';
import { KINDS, CONFIDENCE } from '../constant/defaults.constant.js';

const KNOWN = new Set([
    'type',
    'key',
    'title',
    'tags',
    'body',
    'data',
    'refs',
    'source',
    'confidence',
]);

function foldData({ data, ...rest }) {
    const extra = {};
    for (const [k, v] of Object.entries(rest)) if (!KNOWN.has(k)) extra[k] = v;
    const merged = { ...data, ...extra };
    const known = Object.fromEntries(Object.entries(rest).filter(([k]) => KNOWN.has(k)));
    return { ...known, data: Object.keys(merged).length ? merged : undefined };
}

function formatList(docs) {
    if (!docs.length) return 'Không tìm thấy knowledge phù hợp.';
    return docs
        .map((d, i) => {
            const name = d.title ?? d.key ?? d._id;
            const tags = (d.tags ?? []).join(', ') || '—';
            const body = (d.body ?? '').slice(0, 200);
            return `${i + 1}. [${d.type}] ${name}\n   tags: ${tags}\n   ${body}`;
        })
        .join('\n\n');
}

const refShape = z.object({
    repo: z.string().optional(),
    file: z.string().optional(),
    line: z.string().optional(), // "228" hoặc "228-238" — để mở code nhanh
    symbol: z.string().optional(),
});

export function registerKnowledgeTools(server) {
    server.registerTool(
        'get_knowledge',
        {
            title: 'Get Knowledge',
            description:
                'Truy hồi tri thức đã lưu (pipeline-summary, debug-workflow, rootcause-catalog, playbook) theo query để tái dùng, thay vì tự đoán lại.',
            inputSchema: z.object({
                query: z.string().describe('Từ khóa / mô tả nhiệm vụ'),
                type: z.enum(KINDS).optional(),
                tags: z.array(z.string()).optional(),
                limit: z.number().int().min(1).max(20).default(5),
            }),
        },
        wrap('get_knowledge', async (args) => {
            const docs = await knowledgeService.recall.forQuery(args);
            return textContent(formatList(docs));
        }),
    );

    server.registerTool(
        'list_knowledge',
        {
            title: 'List Knowledge',
            description: 'Liệt kê tri thức theo loại/tags.',
            inputSchema: z.object({
                type: z.enum(KINDS).optional(),
                tags: z.array(z.string()).optional(),
                limit: z.number().int().min(1).max(50).default(20),
            }),
        },
        wrap('list_knowledge', async (args) => {
            const docs = await knowledgeService.entry.list(args);
            return textContent(formatList(docs));
        }),
    );

    server.registerTool(
        'save_knowledge',
        {
            title: 'Save Knowledge',
            description:
                'Lưu/cập nhật (theo key) một mục tri thức ĐÃ KIỂM CHỨNG. Loại: pipeline-summary | ' +
                'debug-workflow | rootcause-catalog | playbook. Payload có cấu trúc ' +
                '(graph {nodes,edges}, causes, diagnosticFlow, rootCauseBranches, negativeEvidence...) ' +
                'truyền thẳng ở top-level, sẽ được gom vào `data`. Cùng key = BỒI THÊM (merge graph/mảng), ' +
                'không đè. Chỉ lưu khi confidence="verified".',
            inputSchema: z
                .object({
                    type: z.enum(KINDS),
                    key: z.string().optional().describe('Định danh để upsert idempotent'),
                    title: z.string().optional(),
                    tags: z.array(z.string()).optional(),
                    body: z.string().optional(),
                    data: z.any().optional(),
                    refs: z.array(refShape).optional(),
                    confidence: z.enum(CONFIDENCE).optional(),
                    source: z.enum(['skill', 'agent', 'manual']).default('agent'),
                })
                .passthrough(),
        },
        wrap('save_knowledge', async (args) => {
            const doc = await knowledgeService.entry.save(foldData(args));
            return textContent(`Đã lưu knowledge: ${doc.key ?? doc._id} [${doc.type}]`);
        }),
    );
}
