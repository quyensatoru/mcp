import 'dotenv/config';
import FirecrawlApp from '@mendable/firecrawl-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from '../src/helpers/slug.helper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../data/mida-doc');
mkdirSync(OUT_DIR, { recursive: true });

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const result = await app.crawlUrl(process.env.MIDA_DOCS_URL, {
  limit: 500,
  scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
});

if (!result.success) {
  console.error('Crawl failed:', result.error);
  process.exit(1);
}

let saved = 0;
for (const page of result.data ?? []) {
  if (!page.markdown) continue;
  const slug = slugify(page.metadata?.title ?? page.url ?? `page-${saved}`);
  const frontmatter = [
    '---',
    `title: "${(page.metadata?.title ?? '').replace(/"/g, "'")}"`,
    `url: "${page.url ?? ''}"`,
    `crawledAt: "${new Date().toISOString()}"`,
    '---',
    '',
  ].join('\n');
  writeFileSync(join(OUT_DIR, `${slug}.md`), frontmatter + page.markdown, 'utf8');
  saved++;
}
console.log(`✅ Crawled ${saved} pages → data/mida-doc/`);
