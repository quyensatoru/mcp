import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPage } from '../lib/playwright.js';
import { logger } from '../helpers/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_PATH = join(__dirname, '../lib/rrweb-harness.html');
const RRWEB_SCRIPT_PATH = join(__dirname, '../../node_modules/rrweb/dist/rrweb.umd.cjs');

export const rrwebService = {
  // events: array rrweb events đã decompress (từ mongo_get_events)
  // atMs: mốc thời gian ms kể từ đầu replay (null = cuối)
  async render(events, { atMs, width = 1280, height = 800 } = {}) {
    if (!events?.length) throw new Error('Không có events để render');
    const firstTs = events[0].timestamp;
    const lastTs = events[events.length - 1].timestamp;
    const seekMs = atMs != null ? atMs : (lastTs - firstTs);

    return withPage(async (page) => {
      // Load harness
      await page.goto(`file://${HARNESS_PATH}`, { waitUntil: 'domcontentloaded' });

      // Inject rrweb từ node_modules
      await page.addScriptTag({ path: RRWEB_SCRIPT_PATH });

      // Setup replayer
      const setupResult = await page.evaluate(
        ({ events, width, height }) => window.setupReplayer(events, width, height),
        { events, width, height }
      );
      if (!setupResult.ok) throw new Error(`rrweb setup failed: ${setupResult.error}`);

      // Seek
      await page.evaluate((ms) => window.seekAndPause(ms), seekMs);
      await page.waitForTimeout(500); // Let rendering settle

      // Screenshot
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      const errors = await page.evaluate(() => window.getErrors());

      return { buffer, seekMs, totalDuration: setupResult.duration, errors };
    });
  },
};
