import path from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    // --- verify fresh-load default keeps auto-convert ON ---
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    freshPage.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    freshPage.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

    await freshPage.goto(url, { waitUntil: 'networkidle' });
    await freshPage.waitForSelector('#autoConvertEnabled', { state: 'attached' });
    const autoConvertCheckedByDefault = await freshPage.$eval('#autoConvertEnabled', (el) => el.checked);
    if (!autoConvertCheckedByDefault) throw new Error('Expected auto-convert to be checked by default on a fresh load');
    await freshPage.waitForSelector('#autoConvertNotice[data-mode="auto"]', { timeout: 5000 });
    await freshPage.close();

    // --- verify tooltip when auto-convert is ON using a fresh context ---
    const ctx1 = await browser.newContext();
    await ctx1.addInitScript(() => {
      try { localStorage.setItem('autoConvertEnabled', 'true'); } catch (e) {}
    });
    const page1 = await ctx1.newPage();
    page1.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page1.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

    await page1.goto(url, { waitUntil: 'networkidle' });
    await page1.waitForSelector('#convertButton');
    // ensure wrapper element exists
    await page1.waitForSelector('.convert-button-wrapper');
    await page1.waitForFunction(() => {
      const w = document.querySelector('.convert-button-wrapper');
      return w && w.getAttribute('aria-describedby') === 'convertTooltip';
    }, null, { timeout: 5000 });
    await page1.waitForSelector('#convertTooltip[aria-hidden="false"]', { timeout: 5000 });
    await page1.close();

    // --- perform normal manual-convert flow with auto-convert OFF ---
    const ctx2 = await browser.newContext();
    await ctx2.addInitScript(() => {
      try { localStorage.setItem('autoConvertEnabled', 'false'); } catch (e) {}
    });
    const page = await ctx2.newPage();
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

    await page.goto(url, { waitUntil: 'networkidle' });

    // Convert button should be present; initially disabled because there are no queued files
    await page.waitForSelector('#convertButton');
    const convertInitiallyDisabled = await page.$eval('#convertButton', (el) => el.disabled);
    if (!convertInitiallyDisabled) throw new Error('Expected #convertButton to be disabled when no queued files and auto-convert is disabled');

    // Add a small MHT file to the hidden file input; because auto-convert is OFF the entry should remain queued
    await page.setInputFiles('#fileInput', {
      name: 'probe.mht',
      mimeType: 'multipart/related',
      buffer: Buffer.from('dummy')
    });

    // Ensure the queued entry is visible and status remains 'queued'
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.file-item'));
      return rows.some(r => r.textContent.includes('probe.mht') && r.textContent.includes('queued'));
    }, { timeout: 3000 });

    // Ensure Convert button is enabled and Download HTML is not yet present
    const convertEnabledAfterAdd = await page.$eval('#convertButton', (el) => !el.disabled);
    if (!convertEnabledAfterAdd) throw new Error('Expected Convert button to be enabled after queuing files');
    const hasDownloadBefore = await page.$('[data-download-id]');
    if (hasDownloadBefore) throw new Error('Expected no Download HTML button before manual Convert');

    // Click Convert and wait for processing to complete (download button appears)
    await page.click('#convertButton');

    await page.waitForSelector('[data-download-id]', { timeout: 8000 });

    // Confirm the queued file is now processed (status -> success) and Convert button is disabled
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.file-item'));
      return rows.some(r => r.textContent.includes('probe.mht') && r.textContent.toLowerCase().includes('success'));
    }, { timeout: 5000 });

    const convertDisabledAfter = await page.$eval('#convertButton', (el) => el.disabled);
    if (!convertDisabledAfter) throw new Error('Expected Convert button to be disabled after processing queued files');

    console.log('auto-convert-manual-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('auto-convert-manual-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();