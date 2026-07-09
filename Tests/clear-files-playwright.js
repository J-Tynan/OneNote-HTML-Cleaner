import path from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addInitScript(() => {
      try { localStorage.setItem('autoConvertEnabled', 'false'); } catch (_) {}
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#fileInput');
    await page.waitForSelector('#clearFilesButton');

    const initialState = await page.evaluate(() => ({
      clearDisabled: document.getElementById('clearFilesButton')?.disabled ?? null,
      zipDisabled: document.getElementById('downloadZip')?.disabled ?? null,
      convertDisabled: document.getElementById('convertButton')?.disabled ?? null,
      badge: document.getElementById('appStateBadge')?.textContent?.trim() ?? '',
      summary: document.getElementById('statusSummary')?.textContent?.trim() ?? '',
      rows: document.querySelectorAll('.file-item').length,
      clearTop: document.getElementById('clearFilesButton')?.getBoundingClientRect().top ?? null,
      zipTop: document.getElementById('downloadZip')?.getBoundingClientRect().top ?? null,
      clearHeight: document.getElementById('clearFilesButton')?.getBoundingClientRect().height ?? null,
      zipHeight: document.getElementById('downloadZip')?.getBoundingClientRect().height ?? null
    }));

    if (initialState.clearDisabled !== true || initialState.zipDisabled !== true || initialState.convertDisabled !== true) {
      throw new Error(`Expected empty-state action buttons disabled, got ${JSON.stringify(initialState)}`);
    }
    if (initialState.badge !== 'Empty') {
      throw new Error(`Expected Empty badge before queueing files, got ${initialState.badge}`);
    }
    if (Math.abs((initialState.clearHeight ?? 0) - (initialState.zipHeight ?? 0)) > 1) {
      throw new Error(`Expected results action buttons to share height in empty state, got ${JSON.stringify({ clearHeight: initialState.clearHeight, zipHeight: initialState.zipHeight })}`);
    }

    await page.setInputFiles('#fileInput', path.resolve('Tests', 'Test File.mht'));

    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('.file-item')).some((row) => {
        const text = row.textContent || '';
        return text.includes('Test File.mht') && text.toLowerCase().includes('queued');
      });
    }, { timeout: 10000 });

    const queuedState = await page.evaluate(() => ({
      clearDisabled: document.getElementById('clearFilesButton')?.disabled ?? null,
      convertDisabled: document.getElementById('convertButton')?.disabled ?? null,
      badge: document.getElementById('appStateBadge')?.textContent?.trim() ?? '',
      rows: document.querySelectorAll('.file-item').length,
      clearTop: document.getElementById('clearFilesButton')?.getBoundingClientRect().top ?? null,
      zipTop: document.getElementById('downloadZip')?.getBoundingClientRect().top ?? null,
      clearHeight: document.getElementById('clearFilesButton')?.getBoundingClientRect().height ?? null,
      zipHeight: document.getElementById('downloadZip')?.getBoundingClientRect().height ?? null
    }));

    if (queuedState.clearDisabled !== false || queuedState.convertDisabled !== false) {
      throw new Error(`Expected clear and convert buttons enabled after queueing, got ${JSON.stringify(queuedState)}`);
    }
    if (queuedState.badge !== 'Queued' || queuedState.rows !== 1) {
      throw new Error(`Expected one queued row before clearing, got ${JSON.stringify(queuedState)}`);
    }
    if (Math.abs((queuedState.clearHeight ?? 0) - (queuedState.zipHeight ?? 0)) > 1) {
      throw new Error(`Expected results action buttons to keep matching heights when queued, got ${JSON.stringify({ clearHeight: queuedState.clearHeight, zipHeight: queuedState.zipHeight })}`);
    }
    if (Math.abs((queuedState.clearTop ?? 0) - (initialState.clearTop ?? 0)) > 1 || Math.abs((queuedState.zipTop ?? 0) - (initialState.zipTop ?? 0)) > 1) {
      throw new Error(`Expected results action row to stay stable when status summary changes, got initial=${JSON.stringify({ clearTop: initialState.clearTop, zipTop: initialState.zipTop })} queued=${JSON.stringify({ clearTop: queuedState.clearTop, zipTop: queuedState.zipTop })}`);
    }

    await page.click('#clearFilesButton');

    await page.waitForFunction(() => document.querySelectorAll('.file-item').length === 0, { timeout: 5000 });

    const clearedState = await page.evaluate(() => ({
      clearDisabled: document.getElementById('clearFilesButton')?.disabled ?? null,
      zipDisabled: document.getElementById('downloadZip')?.disabled ?? null,
      convertDisabled: document.getElementById('convertButton')?.disabled ?? null,
      badge: document.getElementById('appStateBadge')?.textContent?.trim() ?? '',
      summary: document.getElementById('statusSummary')?.textContent?.trim() ?? '',
      rows: document.querySelectorAll('.file-item').length,
      clearTop: document.getElementById('clearFilesButton')?.getBoundingClientRect().top ?? null,
      zipTop: document.getElementById('downloadZip')?.getBoundingClientRect().top ?? null,
      clearHeight: document.getElementById('clearFilesButton')?.getBoundingClientRect().height ?? null,
      zipHeight: document.getElementById('downloadZip')?.getBoundingClientRect().height ?? null
    }));

    if (clearedState.rows !== 0 || clearedState.badge !== 'Empty') {
      throw new Error(`Expected empty list and Empty badge after clearing, got ${JSON.stringify(clearedState)}`);
    }
    if (clearedState.clearDisabled !== true || clearedState.zipDisabled !== true || clearedState.convertDisabled !== true) {
      throw new Error(`Expected buttons disabled after clearing, got ${JSON.stringify(clearedState)}`);
    }
    if (Math.abs((clearedState.clearHeight ?? 0) - (clearedState.zipHeight ?? 0)) > 1) {
      throw new Error(`Expected results action buttons to return to matching heights after clearing, got ${JSON.stringify({ clearHeight: clearedState.clearHeight, zipHeight: clearedState.zipHeight })}`);
    }
    if (clearedState.summary !== 'Added files will appear here with progress, status, and downloads.') {
      throw new Error(`Expected default summary after clearing, got ${clearedState.summary}`);
    }
    if (Math.abs((clearedState.clearTop ?? 0) - (initialState.clearTop ?? 0)) > 1 || Math.abs((clearedState.zipTop ?? 0) - (initialState.zipTop ?? 0)) > 1) {
      throw new Error(`Expected results action row to return to the same position after clearing, got initial=${JSON.stringify({ clearTop: initialState.clearTop, zipTop: initialState.zipTop })} cleared=${JSON.stringify({ clearTop: clearedState.clearTop, zipTop: clearedState.zipTop })}`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => window.innerWidth <= 390);

    const mobileLayout = await page.evaluate(() => {
      const row = document.querySelector('.results-action-row');
      const clearButton = document.getElementById('clearFilesButton');
      const zipButton = document.getElementById('downloadZip');
      const rowRect = row ? row.getBoundingClientRect() : null;
      const clearRect = clearButton ? clearButton.getBoundingClientRect() : null;
      const zipRect = zipButton ? zipButton.getBoundingClientRect() : null;
      return {
        rowWidth: rowRect ? rowRect.width : 0,
        clearWidth: clearRect ? clearRect.width : 0,
        zipWidth: zipRect ? zipRect.width : 0,
        clearTop: clearRect ? clearRect.top : 0,
        zipTop: zipRect ? zipRect.top : 0
      };
    });

    if (mobileLayout.clearTop >= mobileLayout.zipTop) {
      throw new Error(`Expected mobile results actions to stack in source order, got ${JSON.stringify(mobileLayout)}`);
    }
    if (Math.abs(mobileLayout.clearWidth - mobileLayout.zipWidth) > 1) {
      throw new Error(`Expected mobile results actions to share width, got ${JSON.stringify(mobileLayout)}`);
    }
    if (mobileLayout.clearWidth < mobileLayout.rowWidth - 2 || mobileLayout.zipWidth < mobileLayout.rowWidth - 2) {
      throw new Error(`Expected mobile results actions to fill the action row width, got ${JSON.stringify(mobileLayout)}`);
    }

    console.log('clear-files-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('clear-files-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();