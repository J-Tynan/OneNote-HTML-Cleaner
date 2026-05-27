import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/Tests/ui-download-zip.html`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait for the final PASS message to appear (gives the page time to run)
    await page.waitForFunction(() => {
      return document.body && document.body.innerText && document.body.innerText.includes('PASS: ZIP generation invoked (JSZip.generateAsync called)');
    }, { timeout: 5000 });

    // Ensure all PASS messages are present
    const text = await page.evaluate(() => document.body.innerText);
    const checks = [
      'PASS: Per-file Download button rendered',
      'PASS: Per-file download blocked when CSS sidecar exists',
      'PASS: Per-file download attempted with title-derived filename',
      'PASS: Download ZIP button enabled',
      'PASS: ZIP generation invoked (JSZip.generateAsync called)',
      'PASS: ZIP uses title-derived page filenames',
      'PASS: ZIP includes externalized CSS sidecar asset',
      'PASS: ZIP includes fallback README warning for missing sidecar'
    ];

    for (const chk of checks) {
      if (!text.includes(chk)) {
        throw new Error('Missing expected check: ' + chk);
      }
    }

    console.log('ui-download-zip-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('ui-download-zip-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();