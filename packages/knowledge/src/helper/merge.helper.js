// Merge-on-upsert cho save_knowledge: mỗi lần lưu lại 1 key sẽ BỒI THÊM, không đè sạch.
// - scalar (title, body, confidence...) → giá trị mới thắng
// - array (tags, refs, graph.nodes/edges, causes, branches...) → hợp (union), khử trùng
// - object lồng (data, data.graph...) → merge đệ quy
// ponytail: union theo deep-equality; edge/cause đổi nhãn sẽ thành mục mới thay vì báo conflict —
// đủ cho việc gộp topology. Cần phát hiện conflict (rename) thì so theo id/from|to sau.

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// canonical hoá để so sánh không phụ thuộc thứ tự key
function canon(v) {
    if (Array.isArray(v)) return v.map(canon);
    if (isObj(v)) {
        return Object.keys(v)
            .sort()
            .reduce((o, k) => ((o[k] = canon(v[k])), o), {});
    }
    return v;
}

export function unionBy(a = [], b = []) {
    const out = [...a];
    const seen = new Set(a.map((x) => JSON.stringify(canon(x))));
    for (const x of b) {
        const k = JSON.stringify(canon(x));
        if (!seen.has(k)) (seen.add(k), out.push(x));
    }
    return out;
}

function mergeValue(a, b) {
    if (b === undefined) return a;
    if (Array.isArray(a) && Array.isArray(b)) return unionBy(a, b);
    if (isObj(a) && isObj(b)) return deepMerge(a, b);
    return b;
}

export function deepMerge(base = {}, patch = {}) {
    const out = { ...base };
    for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        out[k] = k in out ? mergeValue(out[k], v) : v;
    }
    return out;
}

// gộp entry mới vào doc đã có, bỏ field do Mongo/mongoose quản lý.
export function mergeEntry(existing, patch) {
    const merged = deepMerge(existing, patch);
    delete merged._id;
    delete merged.createdAt;
    delete merged.updatedAt;
    return merged;
}
