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
    const context = await browser.newContext();
    await context.addInitScript(() => {
      try { localStorage.setItem('autoConvertEnabled', 'false'); } catch (_) {}
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#fileInput');
    await page.waitForSelector('#clearFilesButton');

    const initialState = await page.evaluate(() => ({
      clearDisabled: document.getElementById('clearFilesButton')?.disabled ?? null,
      zipDisabled: document.getElementById('downloadZip')?.disabled ?? null,
      convertDisabled: document.getElementById('convertButton')?.disabled ?? null,
      badge: document.getElementById('appStateBadge')?.textContent?.trim() ?? '',
      summary: document.getElementById('statusSummary')?.textContent?.trim() ?? '',
      rows: document.querySelectorAll('.file-item').length
    }));

    if (initialState.clearDisabled !== true || initialState.zipDisabled !== true || initialState.convertDisabled !== true) {
      throw new Error(`Expected empty-state action buttons disabled, got ${JSON.stringify(initialState)}`);
    }
    if (initialState.badge !== 'Empty') {
      throw new Error(`Expected Empty badge before queueing files, got ${initialState.badge}`);
    }

    await page.setInputFiles('#fileInput', path.resolve('Tests', 'Test File.mht'));

    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('.file-item')).some((row) => {
        const text = row.textContent || '';
        return text.includes('Test File.mht') && text.toLowerCase().includes('queued');
      });
    }, { timeout: 10000 });

    const queuedState = await page.evaluate(() => ({
      clearDisabled: document.getElementById('clearFilesButton')?.disabled ?? null,
      convertDisabled: document.getElementById('convertButton')?.disabled ?? null,
      badge: document.getElementById('appStateBadge')?.textContent?.trim() ?? '',
      rows: document.querySelectorAll('.file-item').length
    }));

    if (queuedState.clearDisabled !== false || queuedState.convertDisabled !== false) {
      throw new Error(`Expected clear and convert buttons enabled after queueing, got ${JSON.stringify(queuedState)}`);
    }
    if (queuedState.badge !== 'Queued' || queuedState.rows !== 1) {
      throw new Error(`Expected one queued row before clearing, got ${JSON.stringify(queuedState)}`);
    }

    await page.click('#clearFilesButton');

    await page.waitForFunction(() => document.querySelectorAll('.file-item').length === 0, { timeout: 5000 });

    const clearedState = await page.evaluate(() => ({
      clearDisabled: document.getElementById('clearFilesButton')?.disabled ?? null,
      zipDisabled: document.getElementById('downloadZip')?.disabled ?? null,
      convertDisabled: document.getElementById('convertButton')?.disabled ?? null,
      badge: document.getElementById('appStateBadge')?.textContent?.trim() ?? '',
      summary: document.getElementById('statusSummary')?.textContent?.trim() ?? '',
      rows: document.querySelectorAll('.file-item').length
    }));

    if (clearedState.rows !== 0 || clearedState.badge !== 'Empty') {
      throw new Error(`Expected empty list and Empty badge after clearing, got ${JSON.stringify(clearedState)}`);
    }
    if (clearedState.clearDisabled !== true || clearedState.zipDisabled !== true || clearedState.convertDisabled !== true) {
      throw new Error(`Expected buttons disabled after clearing, got ${JSON.stringify(clearedState)}`);
    }
    if (clearedState.summary !== 'Added files will appear here with progress, status, and downloads.') {
      throw new Error(`Expected default summary after clearing, got ${clearedState.summary}`);
    }

    console.log('clear-files-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('clear-files-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();