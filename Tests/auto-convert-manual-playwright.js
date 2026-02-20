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

    // Ensure page starts with auto-convert disabled for this test
    await ctx.addInitScript(() => {
      try { localStorage.setItem('autoConvertEnabled', 'false'); } catch (e) {}
    });

    const page = await ctx.newPage();
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

    await page.goto(url, { waitUntil: 'networkidle' });

    // Convert button should be present; initially disabled because there are no queued files
    await page.waitForSelector('#convertButton');
    const convertInitiallyDisabled = await page.$eval('#convertButton', (el) => el.disabled);
    if (!convertInitiallyDisabled) throw new Error('Expected #convertButton to be disabled when no queued files and auto-convert is disabled');

    // Add a small MHT file to the hidden file input; because auto-convert is OFF the entry should remain queued
    await page.setInputFiles('#fileInput', {
      name: 'probe.mht',
      mimeType: 'multipart/related',
      buffer: Buffer.from('dummy')
    });

    // Ensure the queued entry is visible and status remains 'queued'
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.file-item'));
      return rows.some(r => r.textContent.includes('probe.mht') && r.textContent.includes('queued'));
    }, { timeout: 3000 });

    // Ensure Convert button is enabled and Download HTML is not yet present
    const convertEnabledAfterAdd = await page.$eval('#convertButton', (el) => !el.disabled);
    if (!convertEnabledAfterAdd) throw new Error('Expected Convert button to be enabled after queuing files');
    const hasDownloadBefore = await page.$('[data-download-id]');
    if (hasDownloadBefore) throw new Error('Expected no Download HTML button before manual Convert');

    // Click Convert and wait for processing to complete (download button appears)
    await page.click('#convertButton');

    await page.waitForSelector('[data-download-id]', { timeout: 8000 });

    // Confirm the queued file is now processed (status -> success) and Convert button is disabled
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.file-item'));
      return rows.some(r => r.textContent.includes('probe.mht') && r.textContent.toLowerCase().includes('success'));
    }, { timeout: 5000 });

    const convertDisabledAfter = await page.$eval('#convertButton', (el) => el.disabled);
    if (!convertDisabledAfter) throw new Error('Expected Convert button to be disabled after processing queued files');

    console.log('auto-convert-manual-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('auto-convert-manual-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();