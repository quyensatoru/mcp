export const KINDS = [
    'pipeline-summary', // topology + runtime flow trong 1 graph {nodes (có type), edges}
    'debug-workflow', // triệu chứng → diagnosticFlow + rootCauseBranches + negativeEvidence (+ confidence)
    'rootcause-catalog', // danh mục nguyên nhân đã biết theo component
    'playbook', // quy trình chung
    'note',
];

export const CONFIDENCE = ['verified', 'likely', 'hypothesis'];

export const PAGE_SIZE = 20;
export const RECALL_LIMIT = 5;

export const TAG_WEIGHT = 2;
