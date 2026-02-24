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

    // ensure Convert tooltip shows when auto-convert is ON
    const ctxTip = await browser.newContext();
    await ctxTip.addInitScript(() => {
      try { localStorage.setItem('autoConvertEnabled', 'true'); } catch (e) {}
    });
    const pageTip = await ctxTip.newPage();
    pageTip.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    pageTip.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));
    await pageTip.goto(url, { waitUntil: 'networkidle' });
    await pageTip.waitForSelector('#convertButton');
    await pageTip.waitForSelector('.convert-button-wrapper');
    // tooltip should be referenced via aria-describedby on wrapper
    await pageTip.waitForFunction(() => {
      const w = document.querySelector('.convert-button-wrapper');
      return w && w.getAttribute('aria-describedby');
    }, null, { timeout: 3000 });
    await pageTip.waitForSelector('#convertTooltip[aria-hidden="false"]', { timeout: 3000 });
    await pageTip.close();

    // manual convert flow with auto-convert OFF
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      try { localStorage.setItem('autoConvertEnabled', 'false'); } catch (e) {}
    });
    const page = await ctx.newPage();
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

    await page.goto(url, { waitUntil: 'networkidle' });

    await page.waitForSelector('#convertButton');
    const initiallyDisabled = await page.$eval('#convertButton', el => el.disabled);
    if (!initiallyDisabled) throw new Error('Expected Convert button to be disabled when no queued files');

    // queue a dummy mht file
    await page.setInputFiles('#fileInput', {
      name: 'smoke-probe.mht',
      mimeType: 'multipart/related',
      buffer: Buffer.from('dummy')
    });

    // wait for queued row
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('.file-item')).some(r => r.textContent.includes('smoke-probe.mht') && r.textContent.includes('queued'));
    }, { timeout: 3000 });

    const enabledAfter = await page.$eval('#convertButton', el => !el.disabled);
    if (!enabledAfter) throw new Error('Expected Convert button enabled after queuing file');

    // click convert and wait for download link
    await page.click('#convertButton');
    await page.waitForSelector('[data-download-id]', { timeout: 8000 });

    // ensure status shows success
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('.file-item')).some(r => r.textContent.includes('smoke-probe.mht') && /success/i.test(r.textContent));
    }, { timeout: 5000 });

    const disabledAfter = await page.$eval('#convertButton', el => el.disabled);
    if (!disabledAfter) throw new Error('Expected Convert button disabled after processing');

    console.log('convert-button-smoke-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('convert-button-smoke-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
