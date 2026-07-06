import { TAG_WEIGHT } from '../constant/defaults.constant.js';

export function rank(docs, { tags = [] } = {}) {
    const wanted = new Set((tags ?? []).map((t) => String(t).toLowerCase()));

    return [...docs]
        .map((doc) => {
            const textScore = doc.score ?? 0;
            const overlap = (doc.tags ?? []).filter((t) =>
                wanted.has(String(t).toLowerCase()),
            ).length;
            return { doc, score: textScore + overlap * TAG_WEIGHT };
        })
        .sort((a, b) => b.score - a.score)
        .map((x) => x.doc);
}
