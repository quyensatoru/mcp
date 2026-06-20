import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data/mida-doc');

let _index = null;
let _ms = null;

function load() {
    if (_index) return;
    const idxPath = join(DATA_DIR, 'index.json');
    if (!existsSync(idxPath)) {
        _index = [];
        return;
    }
    _index = JSON.parse(readFileSync(idxPath, 'utf8'));
    _ms = new MiniSearch({
        fields: ['title', 'excerpt'],
        storeFields: ['slug', 'title', 'url', 'excerpt'],
        idField: 'slug',
    });
    _ms.addAll(_index);
}

export const docsService = {
    search(query, topK = 5) {
        load();
        if (!_ms || !query) return [];
        return _ms.search(query, { limit: topK });
    },
    read(slug) {
        const p = join(DATA_DIR, `${slug}.md`);
        if (!existsSync(p)) throw new Error(`Doc page not found: ${slug}`);
        return readFileSync(p, 'utf8');
    },
    indexJson() {
        load();
        return JSON.stringify(_index ?? []);
    },
    listResources() {
        load();
        return {
            resources: (_index ?? []).map((p) => ({
                uri: `mida-doc://page/${p.slug}`,
                name: p.title,
            })),
        };
    },
};
