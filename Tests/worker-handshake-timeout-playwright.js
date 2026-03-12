import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

function createStaticServer(root) {
  return http.createServer((req, res) => {
    try {
      const safeUrl = decodeURIComponent(req.url.split('?')[0]);
      let filePath = path.join(root, safeUrl);
      if (safeUrl === '/' || safeUrl === '') filePath = path.join(root, 'index.html');
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const map = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };
      const ct = map[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
}

(async () => {
  const root = process.cwd();
  const server = createStaticServer(root);

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));
    page.on('pageerror', (err) => logs.push('PAGE ERROR: ' + (err && err.stack ? err.stack : err)));

    await page.goto(url, { waitUntil: 'networkidle' });

    // Create a WorkerManager instance using a fake worker (blob URL) that
    // never posts the `ready` handshake. Then enqueue a payload and assert
    // the enqueue promise rejects with a handshake timeout diagnostic.
    const result = await page.evaluate(async () => {
      const code = `// fake worker that never posts ready\nself.onmessage = function(e) { /* noop */ };`;
      const blob = new Blob([code], { type: 'application/javascript' });
      const fakeUrl = URL.createObjectURL(blob);

      // Import the WorkerManager class and instantiate with fake worker URL
      const mod = await import('/src/worker-wrapper.js');
      const WM = mod.default;
      const wm = new WM(fakeUrl, { handshakeTimeoutMs: 50 });

      const payload = { id: 'timeout-test-1', fileName: 'test.mht', html: 'dummy', sourceKind: 'mht' };

      // Start enqueue and wait for the configured handshake timeout to reject.
      const enqueuePromise = wm.enqueue(payload, null, [], 2000)
        .then(() => ({ ok: false, error: 'enqueue unexpectedly resolved' }))
        .catch((err) => ({ ok: true, error: String(err && err.error ? err.error : err) }));

      const res = await enqueuePromise;
      // Give wrapper a moment to record diagnostics
      await new Promise(r => setTimeout(r, 20));
      const diags = typeof wm.getDiagnostics === 'function' ? wm.getDiagnostics() : [];
      return { result: res, diags };
    });

    if (!result.result.ok) throw new Error('Expected enqueue to reject on handshake timeout: ' + result.result.error);

    // Verify structured diagnostic was recorded in the wrapper diagnostics buffer
    const diagEntry = (result.diags || []).find(d => d && (d.type === 'handshake-timeout' || (d.id === '__diag__' && /handshake-timeout/.test(d.type || ''))));
    if (!diagEntry) throw new Error('Expected handshake-timeout diagnostic in WorkerManager diagnostics, got: ' + JSON.stringify(result.diags, null, 2));
    if (typeof diagEntry.pendingCount !== 'number') {
      throw new Error('Handshake-timeout diagnostic missing pendingCount: ' + JSON.stringify(diagEntry));
    }

    console.log('worker-handshake-timeout-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('worker-handshake-timeout-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();