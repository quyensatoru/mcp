import { chromium } from 'playwright';
import { logger } from '../helpers/logger.js';

let _browser = null;

export async function getBrowser() {
  if (_browser?.isConnected()) return _browser;
  logger.info('Launching Chromium...');
  _browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  _browser.on('disconnected', () => { _browser = null; });
  return _browser;
}

export async function withPage(fn) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await context.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (_browser) { await _browser.close(); _browser = null; }
}
