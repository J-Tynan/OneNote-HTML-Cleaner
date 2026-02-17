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

    // Ensure deterministic start: clear any stored theme before page loads so initTheme() will persist the default
    await ctx.addInitScript(() => {
      try { localStorage.removeItem('theme'); } catch (e) { /* ignore */ }
    });

    const page = await ctx.newPage();
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));
    await page.goto(url, { waitUntil: 'networkidle' });

    // Initial state should be light (no 'dark' class) and initTheme() should persist that choice
    const hasDarkInitially = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (hasDarkInitially) throw new Error('Expected initial theme to be light');
    const storedAfterLoad = await page.evaluate(() => localStorage.getItem('theme'));
    console.log('STORED_AFTER_LOAD:', storedAfterLoad);
    if (storedAfterLoad !== 'light') throw new Error('Expected localStorage.theme to be "light" after init when none was present');

    // Click the theme toggle and assert dark mode applied + persisted
    await page.click('#themeToggle');
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    const storedAfterDark = await page.evaluate(() => localStorage.getItem('theme'));
    if (storedAfterDark !== 'dark') throw new Error('Expected localStorage.theme to be "dark" after toggle');

    // Click again to return to light
    await page.click('#themeToggle');
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
    const storedAfterLight = await page.evaluate(() => localStorage.getItem('theme'));
    if (storedAfterLight !== 'light') throw new Error('Expected localStorage.theme to be "light" after second toggle');

    // Ensure button state (aria-pressed) reflects theme
    const ariaPressed = await page.getAttribute('#themeToggle', 'aria-pressed');
    if (ariaPressed !== 'false') throw new Error('Expected #themeToggle aria-pressed="false" after reverting to light');

    console.log('theme-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('theme-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();