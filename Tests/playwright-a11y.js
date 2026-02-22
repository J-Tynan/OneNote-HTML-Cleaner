import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';
import { chromium } from 'playwright';

// `require` helper for ESM modules (used to resolve axe-core script path)
const require = createRequire(import.meta.url);

// This script performs an accessibility audit using axe-core against
// each dark theme variant. It writes individual JSON reports and
// exits with a non-zero code if any serious/critical violations are found.

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

  // only audit the two canonical themes: light and default dark (Charcoal)
  const themes = [
    'light',
    'dark'
  ];

  // prepare report directory
  const reportDir = path.join(root, 'Tests', 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  let browser;
  let hadSerious = false;

  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

    // load page and clear any previous state
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('themeVariant');
      document.documentElement.removeAttribute('data-variant');
    });

    // ensure dark mode is active
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isDark) {
      await page.click('#themeToggle');
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    }

    // load axe once (script tag) so it's available for each variant
    const axePath = require.resolve('axe-core/axe.min.js');
    await page.addScriptTag({ path: axePath });

    for (const theme of themes) {
      console.log('Auditing theme:', theme);
      // apply light or dark state
      await page.evaluate((t) => {
        if (t === 'light') {
          document.documentElement.classList.remove('dark');
          document.documentElement.removeAttribute('data-variant');
          localStorage.removeItem('theme');
          localStorage.removeItem('themeVariant');
        } else {
          document.documentElement.classList.add('dark');
          document.documentElement.removeAttribute('data-variant');
          localStorage.setItem('theme', 'dark');
          localStorage.removeItem('themeVariant');
        }
      }, theme);
      if (theme === 'light') {
        await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
      } else {
        await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
      }

      // disable any color transitions to ensure axe sees the final style
      await page.evaluate(() => {
        document.querySelectorAll('.transition-colors').forEach(el => {
          el.style.transition = 'none';
        });
      });

      // log computed styles for dropzone and its ancestors (debug)
      const debugStyles = await page.evaluate(() => {
        const el = document.getElementById('dropzone');
        const cs = getComputedStyle(el);
        let cur = el;
        const ancestors = [];
        while (cur) {
          const c = getComputedStyle(cur);
          ancestors.push({ tag: cur.tagName, bg: c.backgroundColor, color: c.color });
          cur = cur.parentElement;
        }
        return { drop: { bg: cs.backgroundColor, color: cs.color }, ancestors };
      });
      console.log('computed styles:', debugStyles);

      // run axe
      const results = await page.evaluate(async () => await axe.run());
      const outPath = path.join(reportDir, `a11y-${theme}.json`);
      fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

      const serious = results.violations.filter(x => x.impact === 'serious' || x.impact === 'critical');
      if (serious.length) {
        hadSerious = true;
        console.log(`  -> found ${serious.length} serious/critical violations`);
      } else {
        console.log('  -> no serious/critical violations');
      }
    }

    // summary file
    const summary = themes.map(t => {
      const rpt = require(path.join(reportDir, `a11y-${t}.json`));
      const total = rpt.violations.length;
      const sev = rpt.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').length;
      return `${t}: total=${total} serious_or_critical=${sev}`;
    }).join('\n');
    fs.writeFileSync(path.join(reportDir, 'a11y-summary.txt'), summary);

    await browser.close();
    server.close();

    if (hadSerious) {
      console.error('Accessibility audit: SERIOUS/CRITICAL violations detected. See Tests/reports.');
      process.exit(1);
    }

    console.log('Accessibility audit: OK');
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('Accessibility audit: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
