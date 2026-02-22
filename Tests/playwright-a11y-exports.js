import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

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
        '.htm': 'text/html; charset=utf-8',
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

async function auditPage(url, reportBase) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

  await page.goto(url, { waitUntil: 'networkidle' });
  // ensure clean theme state
  await page.evaluate(() => {
    localStorage.removeItem('theme');
    localStorage.removeItem('themeVariant');
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-variant');
  });

  const themes = ['light', 'dark'];
  let hadSerious = false;

  // load axe library once
  const axePath = require.resolve('axe-core/axe.min.js');
  await page.addScriptTag({ path: axePath });

  for (const theme of themes) {
    console.log('Auditing theme:', theme, 'on', url);
    await page.evaluate((t) => {
      if (t === 'light') {
        document.documentElement.classList.remove('dark');
        localStorage.removeItem('theme');
      } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      }
      document.documentElement.removeAttribute('data-variant');
      localStorage.removeItem('themeVariant');
    }, theme);
    if (theme === 'light') {
      await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
    } else {
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    }

    // disable transitions (appearance jitter) as in main audit
    await page.evaluate(() => {
      document.querySelectorAll('.transition-colors').forEach(el => el.style.transition = 'none');
    });

    const results = await page.evaluate(async () => await axe.run());
    const outPath = reportBase + `-${theme}.json`;
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    const serious = results.violations.filter(x => x.impact === 'serious' || x.impact === 'critical');
    if (serious.length) {
      hadSerious = true;
      console.log(`  -> found ${serious.length} serious/critical violations`);
    } else {
      console.log('  -> no serious/critical violations');
    }
  }

  await browser.close();
  return hadSerious;
}

(async () => {
  const argv = process.argv.slice(2);
  let targetDir = null;
  let mhtDir = null;
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--dir' || argv[i] === '-d') && argv[i+1]) {
      targetDir = argv[++i];
    }
    if ((argv[i] === '--mhtDir' || argv[i] === '--mht') && argv[i+1]) {
      mhtDir = argv[++i];
    }
  }
  if (mhtDir) {
    if (!fs.existsSync(mhtDir) || !fs.statSync(mhtDir).isDirectory()) {
      console.error('MHT directory not found:', mhtDir);
      process.exit(1);
    }
  }
  if (!targetDir && !mhtDir) {
    console.error('Specify either --dir <html-folder> or --mhtDir <mht-folder>');
    process.exit(1);
  }
  if (targetDir && (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory())) {
    console.error('Target directory not found:', targetDir);
    process.exit(1);
  }
  // when auditing an existing HTML directory (not MHT conversion), run the pipeline
  // start server for app resources (needed for pipeline imports)
  const root = process.cwd();
  const mainServer = createStaticServer(root);
  await new Promise((r) => mainServer.listen(0, '127.0.0.1', r));
  const mainPort = mainServer.address().port;
  const mainUrl = `http://127.0.0.1:${mainPort}/`;

  let files;
  if (mhtDir) {
    // convert MHTs to HTML in a temp folder
    const outDir = path.join('Tests', 'exports-from-mht');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    // use a browser page for conversion
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // load app so module imports resolve
    await page.goto(mainUrl, { waitUntil: 'networkidle' });
    const mhtFiles = fs.readdirSync(mhtDir).filter(f => f.toLowerCase().endsWith('.mht') || f.toLowerCase().endsWith('.mhtml'));
    for (const mht of mhtFiles) {
      console.log('converting', mht);
      const raw = fs.readFileSync(path.join(mhtDir, mht), 'utf8');
      const base = path.basename(mht, path.extname(mht));
      const html = await page.evaluate(async (opts) => {
        const mht = await import('/src/pipeline/mht.js');
        const pipeline = await import('/src/pipeline/pipeline.js');
        const parsed = mht.parseMht(opts.rawInput || '');
        const html = parsed && parsed.html ? parsed.html : opts.rawInput;
        const run = await pipeline.runPipeline(html, {
          imageMap: parsed && parsed.imageMap ? parsed.imageMap : {},
          defaultTitle: opts.defaultTitle,
          defaultLang: 'en'
        });
        return run.output || '';
      }, { rawInput: raw, defaultTitle: base });
      const name = base + '.html';
      fs.writeFileSync(path.join(outDir, name), html, 'utf8');
    }
    await browser.close();
    targetDir = outDir;
    console.log('converted MHTs to', targetDir);
  }
  files = fs.readdirSync(targetDir).filter(f => f.match(/\.html?$/i));
  if (files.length === 0) {
    console.error('No HTML files found in', targetDir);
    process.exit(1);
  }

  const reportDir = path.join('Tests', 'reports', 'exports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  let overallFail = false;
  const summaryLines = [];

  for (const file of files) {
    const base = path.basename(file, path.extname(file));
    // start a server for this directory
    const server = createStaticServer(targetDir);
    await new Promise((r, e) => server.listen(0, '127.0.0.1', () => r()));
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/${encodeURIComponent(file)}`;

    const reportBase = path.join(reportDir, base);
    console.log('=== auditing', file, '===');
    const failed = await auditPage(url, reportBase);
    if (failed) overallFail = true;

    server.close();
    // add summary marker
    summaryLines.push(`${file}: ${failed ? 'FAIL' : 'OK'}`);
  }

  fs.writeFileSync(path.join(reportDir, 'a11y-exports-summary.txt'), summaryLines.join('\n'));

  if (overallFail) {
    console.error('Some exported pages had serious/critical violations');
    process.exit(1);
  }

  console.log('Exported HTML audit: complete');
})();
