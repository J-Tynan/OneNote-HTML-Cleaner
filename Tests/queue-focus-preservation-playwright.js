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

async function snapshotQueue(page) {
  return page.evaluate(() => ({
    hasFocus: document.hasFocus(),
    visibilityState: document.visibilityState,
    badge: document.getElementById('appStateBadge')?.textContent?.trim() || '',
    rows: Array.from(document.querySelectorAll('.file-item')).map((row) => row.textContent.replace(/\s+/g, ' ').trim())
  }));
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
    await page.setInputFiles('#fileInput', {
      name: 'focus-probe.mht',
      mimeType: 'multipart/related',
      buffer: Buffer.from('dummy')
    });

    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('.file-item')).some((row) => {
        const text = row.textContent || '';
        return text.includes('focus-probe.mht') && text.toLowerCase().includes('queued');
      });
    }, { timeout: 5000 });

    const before = await snapshotQueue(page);

    const otherPage = await context.newPage();
    await otherPage.goto('about:blank', { waitUntil: 'load' });
    await otherPage.bringToFront();
    await page.waitForTimeout(250);
    const blurred = await snapshotQueue(page);

    await page.bringToFront();
    await page.waitForTimeout(250);
    const after = await snapshotQueue(page);

    const beforeRows = JSON.stringify(before.rows);
    const afterRows = JSON.stringify(after.rows);
    if (beforeRows !== afterRows || before.badge !== after.badge) {
      throw new Error(`Queue changed across blur/focus. before=${beforeRows} after=${afterRows} beforeBadge=${before.badge} afterBadge=${after.badge}`);
    }

    console.log('queue-focus-preservation-playwright: OK', JSON.stringify({ before, blurred, after }));
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('queue-focus-preservation-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();