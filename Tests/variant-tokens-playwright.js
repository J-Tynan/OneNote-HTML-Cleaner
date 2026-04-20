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

function rgbStringToNumbers(rgb) {
  // expects formats like "rgb(12, 34, 56)" or "rgba(...)"
  const m = rgb.match(/\d+\,?\s*\d+\,?\s*\d+/);
  if (!m) return [0,0,0];
  return m[0].split(',').map(s => Number(s.trim()));
}

function relativeLuminance([r,g,b]){
  const srgb = [r,g,b].map(v => v/255).map(c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4));
  return 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
}

function contrastRatio(rgbA, rgbB){
  const L1 = relativeLuminance(rgbA);
  const L2 = relativeLuminance(rgbB);
  const lighter = Math.max(L1,L2);
  const darker = Math.min(L1,L2);
  return (lighter + 0.05) / (darker + 0.05);
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

  const variants = [
    'blue-tint','charcoal','mono','blue-high-contrast','warm-ink','deep-indigo','soft-contrast'
  ];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

    // go to page and ensure UI is initialized
    await page.goto(url, { waitUntil: 'networkidle' });
    // clear any stored variant
    await page.evaluate(() => {
      localStorage.removeItem('themeVariant');
      document.documentElement.removeAttribute('data-variant');
    });

    // ensure dark mode is on before running variants
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isDark) {
      await page.click('#themeToggle');
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    }

    for (const v of variants) {
      console.log('Testing variant:', v);
      // apply variant directly
      await page.evaluate((vv) => {
        document.documentElement.setAttribute('data-variant', vv);
        localStorage.setItem('themeVariant', vv);
      }, v);
      await page.waitForFunction((vv) => document.documentElement.dataset.variant === vv, v);
      await page.waitForTimeout(200);

      // grab computed colors for a representative element
      const colors = await page.evaluate(() => {
        const el = document.querySelector('.card-panel') || document.body;
        const style = getComputedStyle(el);
        const bg = style.backgroundColor;
        const text = style.color || getComputedStyle(document.body).color;
        return { bg, text };
      });

      const bgNums = rgbStringToNumbers(colors.bg);
      const textNums = rgbStringToNumbers(colors.text);
      const ratio = contrastRatio(bgNums, textNums);
      console.log(`Variant=${v} bg=${colors.bg} text=${colors.text} contrast=${ratio.toFixed(2)}`);

      // ensure variant actually changed tokens (contrast should be numeric and > 1)
      if (!isFinite(ratio) || ratio <= 1) throw new Error(`Contrast computation failed for variant ${v}`);

      // spot-check minimum contrast for readable UI (3.0 for UI elements)
      if (ratio < 3.0) {
        throw new Error(`Low contrast for variant ${v}: ${ratio.toFixed(2)} < 3.0`);
      }
    }

    console.log('variant-tokens-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('variant-tokens-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }

})();
