import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const SUPPORTED_FLAVORS = ['obsidian', 'commonmark', 'gfm', 'markdown-extra'];

function createStaticServer(root) {
  return http.createServer((req, res) => {
    try {
      const safeUrl = decodeURIComponent((req.url || '/').split('?')[0]);
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
        '.svg': 'image/svg+xml',
        '.mht': 'multipart/related'
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

function parseFlavorArg() {
  const fromArg = process.argv.find((value) => String(value || '').startsWith('--flavor='));
  const candidate = String((fromArg ? fromArg.split('=')[1] : process.env.MARKDOWN_FLAVOR) || '').trim().toLowerCase();
  if (!candidate) return null;
  if (!SUPPORTED_FLAVORS.includes(candidate)) {
    throw new Error(`Unsupported flavor \"${candidate}\". Supported: ${SUPPORTED_FLAVORS.join(', ')}`);
  }
  return candidate;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listMhtFixtures(testsRoot) {
  // Only include .mht files directly under the testsRoot (non-recursive).
  const entries = fs.readdirSync(testsRoot, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.mht') {
      found.push(path.join(testsRoot, entry.name));
    }
  }

  return found.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function toOutputPath(root, testsRoot, markdownRoot, flavor, fixturePath, downloadFilename) {
  const relativeFixturePath = path.relative(testsRoot, fixturePath);
  const relativeDir = path.dirname(relativeFixturePath);
  const fixtureStem = path.basename(fixturePath, '.mht');
  const safeFileName = /\.md$/i.test(downloadFilename || '') ? downloadFilename : `${fixtureStem}.md`;
  const outDir = relativeDir && relativeDir !== '.'
    ? path.join(markdownRoot, flavor, relativeDir)
    : path.join(markdownRoot, flavor);
  ensureDir(outDir);
  const outPath = path.join(outDir, safeFileName);
  return {
    outPath,
    relativeOutPath: path.relative(root, outPath)
  };
}

(async () => {
  const root = process.cwd();
  const testsRoot = path.join(root, 'Tests');
  const selected = parseFlavorArg();
  const flavors = selected ? [selected] : [...SUPPORTED_FLAVORS];
  const markdownRoot = path.join(root, 'Tests', 'Markdown');
  const fixturePaths = listMhtFixtures(testsRoot);
  const exportSnapshots = new Map();

  if (fixturePaths.length === 0) {
    throw new Error(`No .mht fixtures found under ${testsRoot}`);
  }

  const server = createStaticServer(root);
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    console.log(`markdown-export: found ${fixturePaths.length} fixture(s)`);

    for (const flavor of flavors) {
      for (const fixturePath of fixturePaths) {
        const fixtureName = path.basename(fixturePath);
        const context = await browser.newContext();
        await context.addInitScript(() => {
          try { localStorage.setItem('autoConvertEnabled', 'false'); } catch (_err) {}
        });
        const page = await context.newPage();

        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.waitForSelector('#convertButton');

        await page.evaluate((activeFlavor) => {
          const experimental = document.getElementById('experimentalExportEnabled');
          const format = document.getElementById('exportFormat');
          const flavorSelect = document.getElementById('markdownFlavor');

          if (!experimental || !format || !flavorSelect) {
            throw new Error('Expected export controls are missing in UI');
          }

          experimental.checked = true;
          experimental.dispatchEvent(new Event('change', { bubbles: true }));

          format.value = 'markdown';
          format.dispatchEvent(new Event('change', { bubbles: true }));

          flavorSelect.value = activeFlavor;
          flavorSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }, flavor);

        await page.waitForFunction((activeFlavor) => {
          const runtime = window.__getRuntime ? window.__getRuntime() : null;
          if (!runtime || !runtime.downloadHelpers) return false;
          const cfg = runtime.downloadHelpers.getConversionConfig();
          return cfg
            && cfg.ExperimentalExportEnabled === true
            && cfg.ExportFormat === 'markdown'
            && String(cfg.MarkdownFlavor || '').toLowerCase() === String(activeFlavor || '').toLowerCase();
        }, flavor, { timeout: 5000 });

        await page.evaluate(() => {
          const runtime = window.__getRuntime ? window.__getRuntime() : null;
          if (!runtime || !runtime.downloadHelpers) throw new Error('downloadHelpers not available');
          if (runtime.downloadHelpers.__markdownCapturePatched) return;

          window.__markdownDownloads = [];
          const originalDownloadBlob = runtime.downloadHelpers.downloadBlob.bind(runtime.downloadHelpers);
          runtime.downloadHelpers.downloadBlob = (filename, text, mime) => {
            window.__markdownDownloads.push({
              filename: String(filename || ''),
              text: String(text || ''),
              mime: String(mime || '')
            });
            return undefined;
          };
          runtime.downloadHelpers.__markdownCapturePatched = true;
          runtime.downloadHelpers.__markdownOriginalDownloadBlob = originalDownloadBlob;
        });

        await page.setInputFiles('#fileInput', fixturePath);

        await page.waitForFunction((expectedName) => {
          const rows = Array.from(document.querySelectorAll('.file-item'));
          return rows.some((row) => {
            const text = String(row.textContent || '').toLowerCase();
            return text.includes(String(expectedName || '').toLowerCase()) && text.includes('queued');
          });
        }, fixtureName, { timeout: 5000 });

        await page.click('#convertButton');

        await page.waitForFunction((expectedName) => {
          const rows = Array.from(document.querySelectorAll('.file-item'));
          return rows.some((row) => {
            const text = String(row.textContent || '').toLowerCase();
            return text.includes(String(expectedName || '').toLowerCase()) && text.includes('success');
          });
        }, fixtureName, { timeout: 20000 });

        await page.waitForSelector('[data-download-id]');

        const label = await page.textContent('[data-download-id]');
        if (!/download markdown/i.test(String(label || ''))) {
          throw new Error(`Expected markdown download button label for ${fixtureName}, got: ${String(label || '').trim()}`);
        }

        await page.click('[data-download-id]');

        const download = await page.evaluate(() => {
          const all = Array.isArray(window.__markdownDownloads) ? window.__markdownDownloads : [];
          return all.length > 0 ? all[all.length - 1] : null;
        });

        if (!download || !download.filename || !download.text) {
          throw new Error(`Did not capture markdown download payload for flavor ${flavor} and fixture ${fixtureName}`);
        }
        if (!/\.md$/i.test(download.filename)) {
          throw new Error(`Expected markdown filename to end with .md for ${fixtureName}, got ${download.filename}`);
        }
        if (String(download.mime || '').toLowerCase() !== 'text/markdown') {
          throw new Error(`Expected markdown mime text/markdown for ${fixtureName}, got ${download.mime}`);
        }

        const { outPath, relativeOutPath } = toOutputPath(root, testsRoot, markdownRoot, flavor, fixturePath, download.filename);
        fs.writeFileSync(outPath, download.text, 'utf8');

        const fixtureKey = path.relative(testsRoot, fixturePath);
        if (!exportSnapshots.has(fixtureKey)) {
          exportSnapshots.set(fixtureKey, new Map());
        }
        exportSnapshots.get(fixtureKey).set(flavor, String(download.text || ''));

        console.log(`markdown-export: ${flavor} · ${path.relative(testsRoot, fixturePath)} -> ${relativeOutPath}`);

        await context.close();
      }
    }

    if (flavors.length > 1) {
      for (const [fixtureName, byFlavor] of exportSnapshots.entries()) {
        const values = flavors.map((flavor) => byFlavor.get(flavor));
        if (values.every((value) => value === values[0])) {
          console.warn(`markdown-export: notice · all flavors produced identical output for ${fixtureName}`);
        }
      }
    }

    console.log(`export-markdown-playwright: OK (${flavors.join(', ')})`);
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('export-markdown-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
