import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

// Stable-release behavior: native source kinds remain detectable so the worker
// wrapper can preserve an explicit unsupported response without attempting
// native conversion.

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
      const code = `
        self.onmessage = function(e) {
          const payload = e.data || {};
          if (payload.type === 'init') {
            self.postMessage({ type: 'ready', id: 'init', timestamp: Date.now(), hasDOMParser: true });
            return;
          }
          if (payload.fileName === 'native.one') {
            self.postMessage({
              id: payload.id,
              status: 'unsupported',
              code: 'native-disabled',
              reason: 'native importers disabled in this release'
            });
            return;
          }
          self.postMessage({
            id: payload.id,
            status: 'unsupported',
            code: 'worker-dom-unavailable',
            reason: 'DOMParser not available in worker'
          });
        };
      `;
      const blob = new Blob([code], { type: 'application/javascript' });
      const fakeUrl = URL.createObjectURL(blob);

      const mod = await import('/src/worker-wrapper.js');
      const WorkerManager = mod.default;
      const wm = new WorkerManager(fakeUrl);

      const nativeResult = await wm.enqueue({
        fileName: 'native.one',
        sourceKind: 'one',
        html: '<html><body><p>ignored</p></body></html>'
      }).then(
        (value) => ({ resolved: true, value }),
        (error) => ({ resolved: false, error })
      );

      const fallbackResult = await wm.enqueue({
        fileName: 'page.html',
        sourceKind: 'html',
        html: '<html><body><p>Fallback path</p></body></html>'
      }).then(
        (value) => ({ resolved: true, value }),
        (error) => ({ resolved: false, error })
      );

      return { nativeResult, fallbackResult };
    });

    if (result.nativeResult.resolved) {
      throw new Error('Expected native-disabled unsupported response to reject, got: ' + JSON.stringify(result.nativeResult.value));
    }
    if (!result.nativeResult.error || result.nativeResult.error.status !== 'unsupported') {
      throw new Error('Expected native-disabled rejection to preserve unsupported status: ' + JSON.stringify(result.nativeResult));
    }
    if (result.nativeResult.error.code !== 'native-disabled') {
      throw new Error('Expected native-disabled rejection code, got: ' + JSON.stringify(result.nativeResult.error));
    }

    if (!result.fallbackResult.resolved) {
      throw new Error('Expected worker-dom-unavailable unsupported response to fall back successfully: ' + JSON.stringify(result.fallbackResult.error));
    }
    if (!result.fallbackResult.value || result.fallbackResult.value.status !== 'done') {
      throw new Error('Expected fallback to resolve a done result: ' + JSON.stringify(result.fallbackResult.value));
    }
    if (result.fallbackResult.value.outputFormat !== 'html') {
      throw new Error('Expected fallback result to stay html: ' + JSON.stringify(result.fallbackResult.value));
    }

    console.log('worker-unsupported-routing-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('worker-unsupported-routing-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
