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
      zipTop: document.getElementById('downloadZip')?.getBoundingClientRect().top ?? null
    }));

    if (initialState.clearDisabled !== true || initialState.zipDisabled !== true || initialState.convertDisabled !== true) {
      throw new Error(`Expected empty-state action buttons disabled, got ${JSON.stringify(initialState)}`);
    }
    if (initialState.badge !== 'Empty') {
      throw new Error(`Expected Empty badge before queueing files, got ${initialState.badge}`);
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
      zipTop: document.getElementById('downloadZip')?.getBoundingClientRect().top ?? null
    }));

    if (queuedState.clearDisabled !== false || queuedState.convertDisabled !== false) {
      throw new Error(`Expected clear and convert buttons enabled after queueing, got ${JSON.stringify(queuedState)}`);
    }
    if (queuedState.badge !== 'Queued' || queuedState.rows !== 1) {
      throw new Error(`Expected one queued row before clearing, got ${JSON.stringify(queuedState)}`);
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
      zipTop: document.getElementById('downloadZip')?.getBoundingClientRect().top ?? null
    }));

    if (clearedState.rows !== 0 || clearedState.badge !== 'Empty') {
      throw new Error(`Expected empty list and Empty badge after clearing, got ${JSON.stringify(clearedState)}`);
    }
    if (clearedState.clearDisabled !== true || clearedState.zipDisabled !== true || clearedState.convertDisabled !== true) {
      throw new Error(`Expected buttons disabled after clearing, got ${JSON.stringify(clearedState)}`);
    }
    if (clearedState.summary !== 'Added files will appear here with progress, status, and downloads.') {
      throw new Error(`Expected default summary after clearing, got ${clearedState.summary}`);
    }
    if (Math.abs((clearedState.clearTop ?? 0) - (initialState.clearTop ?? 0)) > 1 || Math.abs((clearedState.zipTop ?? 0) - (initialState.zipTop ?? 0)) > 1) {
      throw new Error(`Expected results action row to return to the same position after clearing, got initial=${JSON.stringify({ clearTop: initialState.clearTop, zipTop: initialState.zipTop })} cleared=${JSON.stringify({ clearTop: clearedState.clearTop, zipTop: clearedState.zipTop })}`);
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