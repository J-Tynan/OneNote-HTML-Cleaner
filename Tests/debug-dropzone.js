import http from 'http';
import fs from 'fs';
import path from 'path';
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
        '.css': 'text/css; charset=utf-8'
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
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  for (const theme of ['light', 'dark']) {
    console.log('theme', theme);
    await page.evaluate((t) => {
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.removeItem('theme');
      }
      document.documentElement.removeAttribute('data-variant');
      localStorage.removeItem('themeVariant');
    }, theme);
    await page.waitForTimeout(200);
    const styles = await page.evaluate(() => {
      const el = document.getElementById('dropzone');
      const cs = getComputedStyle(el);
      const body = document.body;
      const csb = getComputedStyle(body);
      const htmlEl = document.documentElement;
      const csh = getComputedStyle(htmlEl);
      return { drop: { bg: cs.backgroundColor, color: cs.color }, body: { bg: csb.backgroundColor, color: csb.color }, html: { bg: csh.backgroundColor, color: csh.color } };
    });
    console.log(styles);
  }

  await browser.close();
  server.close();
})();
