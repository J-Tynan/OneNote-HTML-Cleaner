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
  const url = `http://127.0.0.1:${port}/Tests/ui-download-zip.html`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait for the final PASS message to appear (gives the page time to run)
    await page.waitForFunction(() => {
      return document.body && document.body.innerText && document.body.innerText.includes('PASS: ZIP generation invoked (JSZip.generateAsync called)');
    }, { timeout: 5000 });

    // Ensure all PASS messages are present
    const text = await page.evaluate(() => document.body.innerText);
    const checks = [
      'PASS: Per-file Download button rendered',
      'PASS: Per-file download blocked when CSS sidecar exists',
      'PASS: Per-file download attempted with title-derived filename',
      'PASS: Download ZIP button enabled',
      'PASS: ZIP generation invoked (JSZip.generateAsync called)',
      'PASS: ZIP uses title-derived page filenames',
      'PASS: ZIP includes externalized CSS sidecar asset',
      'PASS: ZIP includes fallback README warning for missing sidecar'
    ];

    for (const chk of checks) {
      if (!text.includes(chk)) {
        throw new Error('Missing expected check: ' + chk);
      }
    }

    console.log('ui-download-zip-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('ui-download-zip-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();