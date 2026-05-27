import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

    await page.goto(url, { waitUntil: 'networkidle' });

    // Stable-release behavior: `.one` is recognized at intake, but the UI must
    // surface it as Unsupported rather than routing it through conversion.
    await page.setInputFiles('#fileInput', {
      name: 'test.one',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('dummy')
    });

    // Wait for the file list entry to render and assert it contains 'Unsupported'
    await page.waitForSelector('.file-item');
    const statusText = await page.$eval('.file-item p.mt-1', (el) => el.textContent);
    if (!/Unsupported/i.test(statusText || '')) {
      throw new Error('Expected UI to mark .one file as Unsupported — got: ' + String(statusText));
    }

    console.log('unsupported-file-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('unsupported-file-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();