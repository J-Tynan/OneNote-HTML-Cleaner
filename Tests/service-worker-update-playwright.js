import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { chromium } from 'playwright';
import { createStaticServer, closeServer } from './playwright-server-helper.js';

const root = process.cwd();
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cacheName = workerSource.match(/const\s+CACHE\s*=([\s\S]*?):\s*'([^']+)'/)?.[2];
if (!cacheName) throw new Error('Could not find the service-worker cache name');
const updatedCacheName = `${cacheName}-test`;
const prefix = '/cleaner/';
let update = false;
const server = createStaticServer(root);
const serveFile = server.listeners('request')[0];
server.removeAllListeners('request');
server.on('request', (req, res) => {
  if (!req.url?.startsWith(prefix)) {
    res.writeHead(404);
    res.end();
    return;
  }
  req.url = '/' + req.url.slice(prefix.length);
  if (req.url === '/service-worker.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
    res.end(update ? workerSource.replace(`'${cacheName}'`, `'${updatedCacheName}'`) : workerSource);
    return;
  }
  serveFile(req, res);
});

async function downloadZip(page, button = page.locator('#downloadZip')) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    button.click()
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSZip.loadAsync(Buffer.concat(chunks));
}

async function convertFixture(page, fixture) {
  await page.locator('#fileInput').setInputFiles(fixture);
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.file-item__status')];
    return rows.some((row) => /success|partial/i.test(row.textContent || ''));
  }, null, { timeout: 20000 });
}

let browser;
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}${prefix}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await caches.open('unrelated-app-cache');
  });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true);

  update = true;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    const worker = registration.waiting || registration.installing;
    if (!worker) throw new Error('Updated service worker was not found');
    if (worker.state !== 'installed') {
      await new Promise((resolve, reject) => {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') resolve();
          if (worker.state === 'redundant') reject(new Error('Updated service worker failed to install'));
        });
      });
    }
    const changed = new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    worker.postMessage({ type: 'SKIP_WAITING' });
    await changed;
    if (worker.state !== 'activated') {
      await new Promise((resolve) => worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') resolve();
      }));
    }
  });
  const cacheNames = await page.evaluate(() => caches.keys());
  assert(cacheNames.includes(updatedCacheName));
  assert(cacheNames.includes('unrelated-app-cache'));
  assert(!cacheNames.includes(cacheName), JSON.stringify(cacheNames));

  await context.setOffline(true);
  await page.goto(url, { waitUntil: 'load' });
  const fixture = path.join(root, 'Tests', 'Test File.mht');
  await convertFixture(page, fixture);
  const htmlZip = await downloadZip(page);
  const htmlName = Object.keys(htmlZip.files).find((name) => name.endsWith('.html'));
  assert(htmlName);
  assert.match(await htmlZip.file(htmlName).async('string'), /Test note 1/i);

  await page.locator('#clearFilesButton').click();
  await page.locator('#advancedOptions').evaluate((element) => { element.open = true; });
  await page.locator('#experimentalExportEnabled').check();
  await page.locator('#exportFormat').selectOption('markdown');
  await convertFixture(page, fixture);
  const markdownZip = await downloadZip(page);
  const markdownName = Object.keys(markdownZip.files).find((name) => name.endsWith('.md'));
  assert(markdownName);
  assert.match(await markdownZip.file(markdownName).async('string'), /Test note 1/i);

  await page.locator('#clearFilesButton').click();
  await page.locator('#exportFormat').selectOption('html');
  await page.locator('#externalizeCssEnabled').check();
  await convertFixture(page, fixture);
  const cssZip = await downloadZip(page);
  const cssName = Object.keys(cssZip.files).find((name) => name.endsWith('.css'));
  const cssHtmlName = Object.keys(cssZip.files).find((name) => name.endsWith('.html'));
  assert(cssName && cssHtmlName);
  assert((await cssZip.file(cssHtmlName).async('string')).includes(cssName));

  await page.locator('#clearFilesButton').click();
  await page.locator('#externalizeCssEnabled').uncheck();
  await page.locator('#fileInput').setInputFiles({
    name: 'notebook.onepkg', mimeType: 'application/octet-stream', buffer: Buffer.from('not a package')
  });
  assert.match(await page.locator('.file-item__status').first().textContent(), /unsupported/i);
  assert.match(await page.locator('.file-item__detail').first().textContent(), /not enabled/i);

  await page.locator('#clearFilesButton').click();
  await convertFixture(page, path.join(root, 'Tests', 'Test section.one'));
  await page.locator('[data-expand-id]').first().click();
  assert.match(await page.locator('.file-item__detail').first().textContent(), /heuristic recovery/i);
  await page.locator('[data-actions-menu-trigger]').first().click();
  const nativeZip = await downloadZip(page, page.locator('[data-download-id]').first());
  assert(Object.keys(nativeZip.files).some((name) => name.endsWith('.html')));
  console.log('service-worker-update-playwright: OK (subpath, update, offline HTML, Markdown, CSS, ZIP and native formats)');
} catch (error) {
  console.error('service-worker-update-playwright: FAIL', error?.stack || error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await closeServer(server);
}
