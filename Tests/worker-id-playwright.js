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

    page.on('pageerror', (err) => console.error('PAGE ERROR:', err && err.stack ? err.stack : err));
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait for the UI to attach the WorkerManager to the runtime object
    await page.waitForFunction(() => {
      const r = window.__getRuntime ? window.__getRuntime() : null;
      return r && r.workerManager;
    }, { timeout: 5000 });

    // Patch enqueue to capture the payload that was actually posted.
    await page.evaluate(() => {
      window.__lastPayload = null;
      const runtime = (window.__getRuntime ? window.__getRuntime() : null);
      if (runtime && runtime.workerManager) {
        const orig = runtime.workerManager.enqueue.bind(runtime.workerManager);
        runtime.workerManager.enqueue = async (p, onprogress, transferList) => {
          const res = await orig(p, onprogress, transferList);
          // capture payload after wrapper has had a chance to assign `id`
          window.__lastPayload = Object.assign({}, p);
          return res;
        };
      }
    });

    // Dispatch a job with no id to trigger wrapper assignment
    const info = await page.evaluate(async () => {
      const runtime = window.__getRuntime ? window.__getRuntime() : null;
      if (!runtime || !runtime.workerManager) {
        return { error: 'runtime or workerManager missing' };
      }
      let result;
      try {
        result = await runtime.workerManager.enqueue({ type: 'probe-no-id' });
      } catch (e) {
        result = { error: e };
      }
      return {
        sent: window.__lastPayload,
        result
      };
    });

    // verify id was assigned and preserved in responses or errors
    if (!info.sent || typeof info.sent.id !== 'string') {
      throw new Error('Wrapper failed to assign id to payload: ' + JSON.stringify(info.sent));
    }
    if (info.result && info.result.id) {
      if (info.result.id !== info.sent.id) {
        throw new Error('Worker response id did not match sent id: ' + info.sent.id + ' vs ' + info.result.id);
      }
      if (info.result.originalId !== null && info.result.originalId !== undefined) {
        throw new Error('Expected originalId to be null for payload with no client id');
      }
    } else if (info.result && info.result.error && info.result.error.id) {
      if (info.result.error.id !== info.sent.id) {
        throw new Error('Worker error id did not match sent id: ' + info.sent.id + ' vs ' + info.result.error.id);
      }
    }

    // Now send a payload with an explicit client id and ensure mapping preserved
    const mapped = await page.evaluate(async () => {
      const runtime = window.__getRuntime ? window.__getRuntime() : null;
      const payload = { id: 'client-123', type: 'probe-client-id' };
      window.__lastPayload = null;
      let result;
      try {
        result = await runtime.workerManager.enqueue(Object.assign({}, payload));
      } catch (e) {
        result = { error: e };
      }
      return {
        sent: window.__lastPayload,
        result
      };
    });
    if (!mapped.sent || mapped.sent.id === 'client-123') {
      throw new Error('Wrapper failed to generate new wrapperId for client-supplied id');
    }
    if (mapped.result && mapped.result.id !== mapped.sent.id) {
      throw new Error('Response id mismatch on second call');
    }
    if (mapped.result && mapped.result.originalId !== 'client-123') {
      throw new Error('originalId was not preserved: ' + mapped.result.originalId);
    }

    console.log('worker-id-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('worker-id-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
