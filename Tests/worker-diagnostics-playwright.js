const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

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

    // Force the worker's pipeline import to fail so worker-globals posts an `init` diagnostic
    await page.route('**/src/pipeline/pipeline.js', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'throw new Error("simulated pipeline import failure for diagnostics test"); export function runPipeline() { return { output: "", logs: [] }; }'
      });
    });

    await page.goto(url, { waitUntil: 'networkidle' });

    // Add a small file to the queue so the status panel (which contains the
    // diagnostics panel) becomes visible — diagnostics are shown inside the
    // status area.
    await page.setInputFiles('#fileInput', {
      name: 'probe.mht',
      mimeType: 'multipart/related',
      buffer: Buffer.from('dummy')
    });

    // Wait for the worker to post diagnostics (verify via the runtime helper)
    let seen = false;
    for (let i = 0; i < 10; i++) {
      const diags = await page.evaluate(() => window.__getWorkerManagerDiagnostics ? window.__getWorkerManagerDiagnostics() : []);
      if (diags && diags.length) { seen = true; break; }
      await new Promise(r => setTimeout(r, 200));
    }
    if (!seen) throw new Error('No diagnostics found in WorkerManager after init failure');

    // Now the UI diagnostics panel should reflect the diagnostic
    await page.waitForSelector('#diagnosticsPanel:not(.hidden)', { timeout: 5000 });
    // Expand the details panel to reveal diagnostics list
    await page.click('#diagnosticsPanel summary');
    const diagnosticsText = await page.locator('#diagnosticsList').innerText();
    if (!/init/.test(diagnosticsText) && !/init-imports/.test(diagnosticsText) && !/unmatched-message/.test(diagnosticsText)) {
      // provide raw HTML for debugging if match fails
      const raw = await page.evaluate(() => document.getElementById('diagnosticsList').innerHTML);
      throw new Error('Expected init diagnostic in UI diagnostics list, got: ' + diagnosticsText + '\nRAW_HTML:' + raw);
    }

    console.log('worker-diagnostics-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('worker-diagnostics-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();