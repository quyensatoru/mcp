const store = new Map();
let ttlMs = 30000;

function configure(ms) {
    ttlMs = ms;
}

function get(key) {
    const hit = store.get(key);
    if (hit && Date.now() - hit.ts < ttlMs) return hit.data;
    return undefined;
}

function set(key, data) {
    store.set(key, { data, ts: Date.now() });
    return data;
}

function clear(key) {
    if (!key) return store.clear();
    store.delete(key);
}

export const cache = { configure, get, set, clear };
