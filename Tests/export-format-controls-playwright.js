import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/Tests/ui-export-format-controls.html`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    await page.waitForFunction(() => {
      const text = document.body && document.body.innerText ? document.body.innerText : '';
      return text.includes('PASS: Export format falls back to HTML when experimental is OFF');
    }, { timeout: 5000 });

    const text = await page.evaluate(() => document.body.innerText || '');
    const checks = [
      'PASS: Toolbar toggle starts unchecked for explicit opt-in HTML enhancement',
      'PASS: Converted-page theme toggle starts unchecked for explicit opt-in HTML enhancement',
      'PASS: Default HTML conversion config keeps toolbar and converted-page theme toggle OFF',
      'PASS: Export format hidden/disabled by default',
      'PASS: Markdown flavor hidden/disabled by default',
      'PASS: Converted-page theme toggle stays available for HTML output while remaining opt-in',
      'PASS: Export format enabled when experimental is ON',
      'PASS: Markdown flavor shown/enabled when Markdown format selected',
      'PASS: Markdown flavor hidden/disabled for non-Markdown format',
      'PASS: Toolbar toggle disabled for non-HTML export format',
      'PASS: Converted-page theme toggle disabled for non-HTML export format',
      'PASS: Converted-page theme toggle HTML-only help text shown for non-HTML formats',
      'PASS: Toolbar toggle re-enabled when export falls back to HTML',
      'PASS: Homepage help text reflects HTML and Markdown experimental choices',
      'PASS: Converted-page theme helper text remains stable when toggles are changed',
      'PASS: Export format falls back to HTML when experimental is OFF',
      'PASS: Conversion config does not expose toolbar style selection',
      'PASS: Converted-page theme toggle is passed in conversion config for HTML output'
    ];

    for (const chk of checks) {
      if (!text.includes(chk)) {
        throw new Error('Missing expected check: ' + chk);
      }
    }

    console.log('export-format-controls-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('export-format-controls-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
