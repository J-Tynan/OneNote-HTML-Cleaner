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

async function assertApprovedShell(page, viewportLabel, expectsColumns) {
  const result = await page.evaluate(() => {
    const importCard = document.querySelector('.home-start-card');
    const dropzone = document.getElementById('controls');
    const advanced = document.getElementById('advancedOptions');
    const importButton = document.getElementById('importButton');
    const convertButton = document.getElementById('convertButton');
    const results = document.getElementById('statusPanel');
    const fileList = document.getElementById('fileList');
    const resultsActions = document.querySelector('.results-action-row');
    if (!importCard || !dropzone || !advanced || !importButton || !convertButton || !results || !fileList || !resultsActions) {
      return { ok: false, reason: 'required homepage elements missing' };
    }

    const snapshot = () => ({
      importTop: importButton.getBoundingClientRect().top,
      advancedTop: advanced.getBoundingClientRect().top,
      convertTop: convertButton.getBoundingClientRect().top,
      resultsTop: results.getBoundingClientRect().top
    });

    const before = snapshot();
    advanced.open = true;
    const after = snapshot();

    return {
      before,
      after,
      dropzoneInsideImport: importCard.contains(dropzone),
      actionsAfterList: Boolean(fileList.compareDocumentPosition(resultsActions) & Node.DOCUMENT_POSITION_FOLLOWING),
      ok: importCard.contains(dropzone)
        && Boolean(fileList.compareDocumentPosition(resultsActions) & Node.DOCUMENT_POSITION_FOLLOWING)
        && before.importTop < before.advancedTop
        && before.advancedTop < before.convertTop
        && after.importTop < after.advancedTop
        && after.advancedTop < after.convertTop
    };
  });

  if (expectsColumns) {
    const alignment = await page.evaluate(() => {
      const importCard = document.querySelector('.home-start-card');
      const results = document.getElementById('statusPanel');
      if (!importCard || !results) return { ok: false, reason: 'column panels missing' };
      return {
        importTop: importCard.getBoundingClientRect().top,
        resultsTop: results.getBoundingClientRect().top,
        ok: Math.abs(importCard.getBoundingClientRect().top - results.getBoundingClientRect().top) <= 1
      };
    });
    result.columnAlignment = alignment;
    result.ok = result.ok && alignment.ok;
  }

  if (!result.ok) {
    throw new Error(`${viewportLabel}: unexpected approved shell. details=${JSON.stringify(result)}`);
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
    await assertApprovedShell(desktopPage, 'desktop', true);
    await desktopContext.close();

    const tabletContext = await browser.newContext({ viewport: { width: 820, height: 1180 } });
    const tabletPage = await tabletContext.newPage();
    await tabletPage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(tabletPage, 'tablet-layout-b');
    await assertApprovedShell(tabletPage, 'tablet-layout-b', false);
    await tabletContext.close();

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(mobilePage, 'mobile');
    await assertApprovedShell(mobilePage, 'mobile', false);
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
