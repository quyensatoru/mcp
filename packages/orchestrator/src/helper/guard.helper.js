import { READ_VERBS, ADMIN_VERBS } from '../constant/defaults.constant.js';

const readSet = new Set(READ_VERBS);
const adminSet = new Set(ADMIN_VERBS);

const RANK = { read: 0, write: 1, admin: 2 };

function tokenize(tool) {
    return String(tool)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

function needFor(tool) {
    const tokens = tokenize(tool);
    if (tokens.some((t) => adminSet.has(t))) return 'admin';
    if (tokens.some((t) => readSet.has(t))) return 'read';
    return 'write';
}

function check(tool, capability) {
    const need = needFor(tool);
    const have = capability ?? 'read';
    if (RANK[have] >= RANK[need]) return { allow: true, need, have };
    return { allow: false, need, have, reason: `tool cần '${need}', target chỉ có '${have}'` };
}

export const guard = { needFor, check };
