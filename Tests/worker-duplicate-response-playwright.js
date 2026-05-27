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
      // fake worker replies to init handshake then posts two responses for each job
      const code = `self.onmessage = function(e) {
        const msg = e.data;
        if (msg && msg.type === 'init') {
          self.postMessage({ type: 'ready', id: 'init' });
          return;
        }
        if (msg && msg.id) {
          self.postMessage({ id: msg.id, status: 'done', outputHtml: 'ok' });
          self.postMessage({ id: msg.id, status: 'done', outputHtml: 'ok' });
        }
      };`;
      const blob = new Blob([code], { type: 'application/javascript' });
      const fakeUrl = URL.createObjectURL(blob);
      const mod = await import('/src/worker-wrapper.js');
      const WM = mod.default;
      const wm = new WM(fakeUrl);

      // wait until ready
      await new Promise(r => setTimeout(r, 100));

      const payload = { type: 'duplicate-test' };
      let res;
      try {
        res = await wm.enqueue(payload);
      } catch (e) {
        res = { error: e };
      }
      // give diagnostics a moment
      await new Promise(r => setTimeout(r, 50));
      const diags = wm.getDiagnostics();
      return { res, diags };
    });

    if (!result.res || result.res.status !== 'done') {
      throw new Error('expected initial response, got ' + JSON.stringify(result.res));
    }
    const hasDup = (result.diags || []).some(d => d && d.kind === 'duplicate-response' && d.id === result.res.id);
    if (!hasDup) {
      throw new Error('expected duplicate-response diagnostic, got: ' + JSON.stringify(result.diags));
    }

    console.log('worker-duplicate-response-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('worker-duplicate-response-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
