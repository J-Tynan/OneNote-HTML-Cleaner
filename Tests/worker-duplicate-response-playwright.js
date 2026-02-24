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
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('worker-duplicate-response-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
