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
      'PASS: Toolbar style dropdown exposes all supported presets in order',
      'PASS: Toolbar style hidden/disabled by default when toolbar is OFF',
      'PASS: Toolbar style shown/enabled when toolbar injection is ON',
      'PASS: Toolbar style presets round-trip through the UI config while HTML export is active',
      'PASS: Export format hidden/disabled by default',
      'PASS: Markdown flavor hidden/disabled by default',
      'PASS: Converted-page theme toggle enabled by default for HTML output',
      'PASS: OLED option disabled until converted-page theme toggle is enabled',
      'PASS: Export format enabled when experimental is ON',
      'PASS: Markdown flavor shown/enabled when Markdown format selected',
      'PASS: Markdown flavor hidden/disabled for non-Markdown format',
      'PASS: Toolbar toggle disabled for non-HTML export format',
      'PASS: Toolbar style hidden/disabled for non-HTML export format',
      'PASS: Toolbar style HTML-only help text shown for non-HTML formats',
      'PASS: Converted-page theme toggle disabled for non-HTML export format',
      'PASS: Converted-page theme toggle HTML-only help text shown for non-HTML formats',
      'PASS: Toolbar style selection is preserved while toolbar controls are gated for non-HTML export',
      'PASS: Toolbar toggle re-enabled when export falls back to HTML',
      'PASS: Toolbar style selection is restored when export falls back to HTML',
      'PASS: Homepage help text reflects HTML and Markdown experimental choices',
      'PASS: OLED option enabled when converted-page theme toggle is checked',
      'PASS: Converted-page theme helper text remains stable when toggles are changed',
      'PASS: Export format falls back to HTML when experimental is OFF',
      'PASS: Toolbar style is passed in conversion config when toolbar is enabled',
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
