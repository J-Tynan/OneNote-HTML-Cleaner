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
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  const widthBefore = await page.evaluate(() => document.body.clientWidth);
  console.log('width before details:', widthBefore);

  await page.click('#advancedOptions > summary');
  await page.waitForSelector('#advancedOptions[open]');

  const widthAfter = await page.evaluate(() => document.body.clientWidth);
  console.log('width after details:', widthAfter);

  const beforeToggle = await page.evaluate(() => {
    const importButton = document.getElementById('importButton');
    const notice = document.getElementById('autoConvertNotice');
    return {
      buttonTop: importButton ? importButton.getBoundingClientRect().top + window.scrollY : 0,
      scrollY: window.scrollY,
      noticeHeight: notice ? notice.getBoundingClientRect().height : 0,
      noticeText: notice ? notice.textContent.replace(/\s+/g, ' ').trim() : ''
    };
  });
  console.log('before auto-convert toggle:', beforeToggle);

  await page.click('#autoConvertEnabled');
  await page.waitForFunction(() => {
    const notice = document.getElementById('autoConvertNotice');
    return notice && notice.textContent.includes('convert them manually');
  });

  const afterToggle = await page.evaluate(() => {
    const importButton = document.getElementById('importButton');
    const notice = document.getElementById('autoConvertNotice');
    return {
      buttonTop: importButton ? importButton.getBoundingClientRect().top + window.scrollY : 0,
      scrollY: window.scrollY,
      noticeHeight: notice ? notice.getBoundingClientRect().height : 0,
      noticeText: notice ? notice.textContent.replace(/\s+/g, ' ').trim() : ''
    };
  });
  console.log('after auto-convert toggle:', afterToggle);

  await browser.close();
  server.close();

  const widthStable = widthBefore === widthAfter;
  const buttonTopStable = Math.abs(beforeToggle.buttonTop - afterToggle.buttonTop) <= 1;
  const noticeStillVisible = afterToggle.noticeHeight > 0;

  process.exit(widthStable && buttonTopStable && noticeStillVisible ? 0 : 1);
})();
