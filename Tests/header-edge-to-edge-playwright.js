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

async function seedSelectedWorkbenchRow(page) {
  await page.evaluate(async () => {
    const module = await import('/src/ui.js');
    module.addFilesToQueue([
      new File(
        ['Queued result fixture'],
        'Quarterly-planning-notes-with-a-long-descriptive-file-name.mht',
        { type: 'multipart/related' }
      )
    ]);
  });
  await page.waitForSelector('.file-item.workbench-row');
  await page.locator('.workbench-select').check();
}

async function assertWorkbenchContentFits(page, viewportLabel) {
  const result = await page.evaluate(() => {
    const card = document.getElementById('statusPanel');
    const actionRow = document.querySelector('.results-action-row');
    const row = document.querySelector('.file-item.workbench-row');
    if (!card || !actionRow || !row) return { ok: false, reason: 'populated workbench elements missing' };

    const cardRect = card.getBoundingClientRect();
    const actionChildren = [...actionRow.children];
    const visibleElements = [
      ...row.querySelectorAll('.file-item__name, .file-item__type, .file-item__status, .file-item__size, .file-item__actions, button, input'),
      ...actionChildren,
      ...actionRow.querySelectorAll('button')
    ].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const contained = visibleElements.every((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= cardRect.left - 1
        && rect.right <= cardRect.right + 1
        && rect.top >= cardRect.top - 1
        && rect.bottom <= cardRect.bottom + 1;
    });
    const actionRects = actionChildren.map((element) => {
      const rect = element.getBoundingClientRect();
      return { text: element.textContent?.replace(/\s+/g, ' ').trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    const selectionSummary = document.getElementById('selectionSummary');
    const selectionSummaryRect = selectionSummary?.getBoundingClientRect();
    const selectionSummaryUsable = Boolean(selectionSummaryRect && selectionSummaryRect.width >= 128);
    const actionOverlap = actionRects.some((rect, index) => actionRects.slice(index + 1).some((other) => (
      rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top
    )));
    const documentHasHorizontalOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;

    return {
      ok: contained && selectionSummaryUsable && !actionOverlap && !documentHasHorizontalOverflow,
      contained,
      selectionSummaryUsable,
      actionOverlap,
      documentHasHorizontalOverflow,
      card: { left: cardRect.left, right: cardRect.right, top: cardRect.top, bottom: cardRect.bottom },
      actionRects
    };
  });

  if (!result.ok) {
    throw new Error(`${viewportLabel}: populated results workbench does not fit. details=${JSON.stringify(result)}`);
  }
}

async function assertApprovedShell(page, viewportLabel, {
  expectsColumns,
  expectsStackedActions = false,
  expectsCompactAdvanced = false
}) {
  const result = await page.evaluate(() => {
    const importCard = document.querySelector('.home-start-card');
    const dropzone = document.getElementById('controls');
    const advanced = document.getElementById('advancedOptions');
    const importButton = document.getElementById('importButton');
    const folderImportButton = document.getElementById('folderImportButton');
    const convertButton = document.getElementById('convertButton');
    const results = document.getElementById('statusPanel');
    const fileList = document.getElementById('fileList');
    const resultsActions = document.querySelector('.results-action-row');
    const advancedCard = advanced?.closest('.home-advanced-card');
    const queueActionStrip = advancedCard?.querySelector('.queue-action-strip');
    if (!importCard || !dropzone || !advanced || !advancedCard || !queueActionStrip || !importButton || !folderImportButton || !convertButton || !results || !fileList || !resultsActions) {
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
      advancedOutsideImport: !importCard.contains(advanced),
      actionsAfterList: Boolean(fileList.compareDocumentPosition(resultsActions) & Node.DOCUMENT_POSITION_FOLLOWING),
      importButtons: [importButton, folderImportButton].map((button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }),
      resultButtons: [...resultsActions.querySelectorAll('button')].map((button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }),
      advanced: (() => {
        const cardRect = advancedCard.getBoundingClientRect();
        const statusControlsRect = document.getElementById('statusControls').getBoundingClientRect();
        const queueRect = queueActionStrip.getBoundingClientRect();
        const visibleControlsFit = [...advancedCard.querySelectorAll('input, select, button')]
          .filter((control) => {
            const rect = control.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .every((control) => {
            const rect = control.getBoundingClientRect();
            return rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1;
          });
        return {
          open: advanced.open,
          visibleControlsFit,
          queueFollowsOptions: queueRect.top >= statusControlsRect.bottom,
          convertInsideQueue: queueActionStrip.contains(convertButton)
        };
      })(),
      ok: importCard.contains(dropzone)
        && !importCard.contains(advanced)
        && Boolean(fileList.compareDocumentPosition(resultsActions) & Node.DOCUMENT_POSITION_FOLLOWING)
        && before.importTop < before.advancedTop
        && before.advancedTop < before.convertTop
        && after.importTop < after.advancedTop
        && after.advancedTop < after.convertTop
    };
  });

  if (expectsColumns) {
    const alignment = await page.evaluate(() => {
      const layout = document.querySelector('.home-layout');
      const importCard = document.querySelector('.home-start-card');
      const results = document.getElementById('statusPanel');
      if (!layout || !importCard || !results) return { ok: false, reason: 'column panels missing' };
      const columns = getComputedStyle(layout).gridTemplateColumns.split(' ').filter(Boolean);
      return {
        importTop: importCard.getBoundingClientRect().top,
        resultsTop: results.getBoundingClientRect().top,
        columns,
        ok: columns.length === 2
          && Math.abs(importCard.getBoundingClientRect().top - results.getBoundingClientRect().top) <= 1
      };
    });
    result.columnAlignment = alignment;
    result.ok = result.ok && alignment.ok;
  } else {
    const stacking = await page.evaluate(() => {
      const layout = document.querySelector('.home-layout');
      if (!layout) return { ok: false, reason: 'homepage layout missing' };
      const columns = getComputedStyle(layout).gridTemplateColumns.split(' ').filter(Boolean);
      return { columns, ok: columns.length === 1 };
    });
    result.stackedLayout = stacking;
    result.ok = result.ok && stacking.ok;
  }

  if (expectsStackedActions) {
    const importButtonsStacked = result.importButtons[1].top > result.importButtons[0].top
      && result.importButtons.every((button) => button.height >= 44);
    const resultButtonsStacked = result.resultButtons.every((button, index, buttons) => index === 0 || button.top > buttons[index - 1].top);
    result.stackedActions = { importButtonsStacked, resultButtonsStacked };
    result.ok = result.ok && importButtonsStacked && resultButtonsStacked;
  }

  if (expectsCompactAdvanced) {
    const { advanced } = result;
    result.ok = result.ok && advanced.open && advanced.visibleControlsFit
      && advanced.queueFollowsOptions && advanced.convertInsideQueue;
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
    await assertApprovedShell(desktopPage, 'desktop', { expectsColumns: true });
    await desktopContext.close();

    const tabletContext = await browser.newContext({ viewport: { width: 768, height: 768 } });
    const tabletPage = await tabletContext.newPage();
    await tabletPage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(tabletPage, 'compact-workbench');
    await assertApprovedShell(tabletPage, 'compact-workbench', {
      expectsColumns: true,
      expectsCompactAdvanced: true
    });
    await seedSelectedWorkbenchRow(tabletPage);
    await assertWorkbenchContentFits(tabletPage, 'compact-workbench');
    await tabletContext.close();

    const approvedTabletContext = await browser.newContext({ viewport: { width: 820, height: 1180 } });
    const approvedTabletPage = await approvedTabletContext.newPage();
    await approvedTabletPage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(approvedTabletPage, 'approved-tablet');
    await assertApprovedShell(approvedTabletPage, 'approved-tablet', {
      expectsColumns: true,
      expectsCompactAdvanced: true
    });
    await seedSelectedWorkbenchRow(approvedTabletPage);
    await assertWorkbenchContentFits(approvedTabletPage, 'approved-tablet');
    await approvedTabletContext.close();

    const narrowContext = await browser.newContext({ viewport: { width: 700, height: 900 } });
    const narrowPage = await narrowContext.newPage();
    await narrowPage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(narrowPage, 'narrow-tablet');
    await assertApprovedShell(narrowPage, 'narrow-tablet', { expectsColumns: false });
    await narrowContext.close();

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(url, { waitUntil: 'networkidle' });
    await assertHeaderEdgeToEdge(mobilePage, 'mobile');
    await assertApprovedShell(mobilePage, 'mobile', { expectsColumns: false, expectsStackedActions: true });
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
