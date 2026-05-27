import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

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

async function assertPrimaryColumnOrder(page, viewportLabel) {
  const result = await page.evaluate(() => {
    const dropzone = document.getElementById('controls');
    const advanced = document.getElementById('advancedOptions');
    const importButton = document.getElementById('importButton');
    if (!dropzone || !advanced || !importButton) {
      return { ok: false, reason: 'required homepage elements missing' };
    }

    const snapshot = () => ({
      importTop: importButton.getBoundingClientRect().top,
      dropzoneTop: dropzone.getBoundingClientRect().top,
      advancedTop: advanced.getBoundingClientRect().top
    });

    const before = snapshot();
    advanced.open = true;
    const after = snapshot();

    return {
      before,
      after,
      ok: before.importTop < before.dropzoneTop
        && before.dropzoneTop < before.advancedTop
        && after.importTop < after.dropzoneTop
        && after.dropzoneTop < after.advancedTop
    };
  });

  if (!result.ok) {
    throw new Error(`${viewportLabel}: unexpected homepage order. details=${JSON.stringify(result)}`);
  }
}

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    const desktopContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(desktopPage, 'desktop');
    await assertPrimaryColumnOrder(desktopPage, 'desktop');
    await desktopContext.close();

    const tabletContext = await browser.newContext({ viewport: { width: 820, height: 1180 } });
    const tabletPage = await tabletContext.newPage();
    await tabletPage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(tabletPage, 'tablet-layout-b');
    await assertPrimaryColumnOrder(tabletPage, 'tablet-layout-b');
    await tabletContext.close();

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(mobilePage, 'mobile');
    await assertPrimaryColumnOrder(mobilePage, 'mobile');
    await mobileContext.close();

    console.log('header-edge-to-edge-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('header-edge-to-edge-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
