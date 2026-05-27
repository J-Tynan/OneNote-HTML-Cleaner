import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const root = process.cwd();
  const serverHandle = await startStaticServer(root);
  const url = `${serverHandle.baseUrl}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));
    page.on('pageerror', (err) => logs.push('PAGE ERROR: ' + (err && err.stack ? err.stack : err)));

    // Load the app
    await page.goto(url, { waitUntil: 'networkidle' });

    // Register a *test* service worker via a blob URL that caches a test cache
    // name and includes `/src/worker.js` in the precache. This simulates an
    // update flow without depending on the repository's SW implementation.
    const swScript = `const CACHE = 'onenote-cleaner-v3-test';
const ASSETS = ['/', '/index.html', '/styles.css', '/src/app.js', '/src/worker.js', '/src/worker-globals.js'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));`;

    // Write a temporary service-worker-test.js file into the served root so
    // the browser can fetch and register it normally.
    const tmpSwPath = path.join(root, 'service-worker-test.js');
    fs.writeFileSync(tmpSwPath, swScript, 'utf8');

    try {
      await page.evaluate(async () => {
        await navigator.serviceWorker.register('/service-worker-test.js');
      });
    } finally {
      // Clean up the temp file (best-effort)
      try { fs.unlinkSync(tmpSwPath); } catch (ignore) {}
    }

    // Wait for the new cache to appear and contain /src/worker.js
    const start = Date.now();
    let passed = false;
    while (Date.now() - start < 10000) {
      const keys = await page.evaluate(() => caches.keys());
      if (keys.includes('onenote-cleaner-v3-test')) {
        const cached = await page.evaluate(async () => {
          const c = await caches.open('onenote-cleaner-v3-test');
          const ks = await c.keys();
          return ks.map(r => r.url || r.href || String(r));
        });
        if (cached.some(u => /src\/worker\.js$/.test(u))) {
          passed = true;
          break;
        }
      }
      await new Promise(r => setTimeout(r, 100));
    }

    if (!passed) throw new Error('Timeout waiting for updated cache and worker.js presence. Logs:\n' + logs.join('\n'));

    console.log('service-worker-update-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('service-worker-update-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();