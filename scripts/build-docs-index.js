import 'dotenv/config';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, '../data/mida-doc');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const [k, ...rest] = line.split(': ');
    if (k) meta[k.trim()] = rest.join(': ').replace(/^"|"$/g, '').trim();
  }
  return { meta, body: match[2] };
}

const files = readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'index.md');
const index = [];

for (const file of files) {
  const slug = basename(file, '.md');
  const raw = readFileSync(join(DIR, file), 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const excerpt = body.replace(/#+\s+/g, '').replace(/\n+/g, ' ').slice(0, 200).trim();
  index.push({ slug, title: meta.title ?? slug, url: meta.url ?? '', excerpt, crawledAt: meta.crawledAt ?? '' });
}

writeFileSync(join(DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
console.log(`✅ Built index: ${index.length} pages → data/mida-doc/index.json`);
