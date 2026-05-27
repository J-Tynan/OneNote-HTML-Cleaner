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

    const result = await page.evaluate(async () => {
      // fake worker posts an unmatched message after sending ready
      const code = `
self.onmessage = function(e) {
  if (e.data && e.data.type === 'init') {
    self.postMessage({ type: 'ready' });
    // send unmatched message
    self.postMessage({ id: 'unknown-id', status: 'done', outputHtml: 'foo' });
  }
};`;
      const blob = new Blob([code], { type: 'application/javascript' });
      const fakeUrl = URL.createObjectURL(blob);
      const mod = await import('/src/worker-wrapper.js');
      const WM = mod.default;
      const wm = new WM(fakeUrl);
      // wait a moment for ready+unmatched
      await new Promise(r => setTimeout(r, 100));
      const diags = wm.getDiagnostics();
      return { diags };
    });

    const hasUnmatched = (result.diags || []).some(d => d && d.kind === 'unmatched-message' && d.id === 'unknown-id');
    if (!hasUnmatched) {
      throw new Error('Expected unmatched-message diagnostic, got: ' + JSON.stringify(result.diags));
    }

    console.log('worker-unmatched-message-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('worker-unmatched-message-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
