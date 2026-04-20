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

async function assertHeaderEdgeToEdge(page, viewportLabel) {
  const result = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return { ok: false, reason: 'header missing' };

    const rect = header.getBoundingClientRect();
    const leftDelta = Math.abs(rect.left - 0);
    const rightDelta = Math.abs(rect.right - window.innerWidth);
    const tolerance = 1;
    const leftAligned = leftDelta <= tolerance;
    const rightAligned = rightDelta <= tolerance;
    const headerWithinViewport = rect.left >= -tolerance && rect.right <= (window.innerWidth + tolerance);
    const documentHasHorizontalOverflow = document.documentElement.scrollWidth > (window.innerWidth + tolerance);

    return {
      ok: leftAligned && rightAligned && headerWithinViewport && !documentHasHorizontalOverflow,
      leftAligned,
      rightAligned,
      headerWithinViewport,
      documentHasHorizontalOverflow,
      leftDelta,
      rightDelta,
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      headerRect: {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height
      }
    };
  });

  if (!result.ok) {
    throw new Error(`${viewportLabel}: header not edge-to-edge. details=${JSON.stringify(result)}`);
  }
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

    const desktopContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(desktopPage, 'desktop');
    await desktopContext.close();

    const tabletContext = await browser.newContext({ viewport: { width: 820, height: 1180 } });
    const tabletPage = await tabletContext.newPage();
    await tabletPage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(tabletPage, 'tablet-layout-b');
    await tabletContext.close();

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(mobilePage, 'mobile');
    await mobileContext.close();

    console.log('header-edge-to-edge-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('header-edge-to-edge-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
