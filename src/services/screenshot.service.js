import { withPage } from '../lib/playwright.js';

export const screenshotService = {
  async capture(url, { viewport = { width: 1280, height: 800 }, waitFor = 'networkidle' } = {}) {
    return withPage(async (page) => {
      await page.setViewportSize(viewport);
      await page.goto(url, {
        waitUntil: waitFor === 'networkidle' ? 'networkidle' : 'load',
        timeout: 30000,
      });
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      const title = await page.title();
      const consoleErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      return { buffer, title, url: page.url(), consoleErrors };
    });
  },
};
