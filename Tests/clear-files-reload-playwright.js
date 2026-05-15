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

async function waitForDraftCleared(page) {
  await page.waitForFunction(async () => {
    if (sessionStorage.getItem('oncHomepageDraftSnapshot')) return false;
    const instanceId = sessionStorage.getItem('oncHomepageDraftInstance');
    if (!instanceId) return true;

    return await new Promise((resolve) => {
      const request = indexedDB.open('onc-homepage-drafts', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('drafts', 'readonly');
        const getRequest = tx.objectStore('drafts').get(instanceId);
        getRequest.onsuccess = () => resolve(!getRequest.result);
        getRequest.onerror = () => resolve(false);
      };
      request.onerror = () => resolve(false);
    });
  }, { timeout: 10000 });
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
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#fileInput');
    await page.waitForSelector('#clearFilesButton');

    await page.setInputFiles('#fileInput', path.resolve('Tests', 'Test File.mht'));

    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('.file-item')).some((row) => {
        const text = row.textContent || '';
        return text.includes('Test File.mht') && text.toLowerCase().includes('success');
      });
    }, { timeout: 15000 });

    await page.evaluate(() => {
      const input = document.getElementById('autoConvertEnabled');
      if (!(input instanceof HTMLInputElement)) throw new Error('autoConvertEnabled missing');
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.setInputFiles('#fileInput', path.resolve('Tests', 'Dental Appointment.mht'));

    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.file-item')).map((row) => row.textContent || '');
      return rows.length === 2
        && rows.some((text) => text.includes('Test File.mht') && text.toLowerCase().includes('success'))
        && rows.some((text) => text.includes('Dental Appointment.mht') && text.toLowerCase().includes('queued'));
    }, { timeout: 10000 });

    const clearEnabled = await page.$eval('#clearFilesButton', (button) => !button.disabled);
    if (!clearEnabled) {
      throw new Error('Expected Clear files button enabled before clearing');
    }

    await page.click('#clearFilesButton');

    await page.waitForFunction(() => {
      return document.querySelectorAll('.file-item').length === 0
        && (document.getElementById('appStateBadge')?.textContent || '').trim() === 'Empty';
    }, { timeout: 5000 });

    await waitForDraftCleared(page);

    await page.reload({ waitUntil: 'networkidle' });

    const restoredState = await page.evaluate(() => ({
      rows: document.querySelectorAll('.file-item').length,
      badge: document.getElementById('appStateBadge')?.textContent?.trim() ?? '',
      clearDisabled: document.getElementById('clearFilesButton')?.disabled ?? null,
      zipDisabled: document.getElementById('downloadZip')?.disabled ?? null,
      convertDisabled: document.getElementById('convertButton')?.disabled ?? null
    }));

    if (restoredState.rows !== 0 || restoredState.badge !== 'Empty') {
      throw new Error(`Expected cleared queue to stay empty after reload, got ${JSON.stringify(restoredState)}`);
    }
    if (restoredState.clearDisabled !== true || restoredState.zipDisabled !== true || restoredState.convertDisabled !== true) {
      throw new Error(`Expected action buttons disabled after reload of cleared queue, got ${JSON.stringify(restoredState)}`);
    }

    console.log('clear-files-reload-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('clear-files-reload-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();