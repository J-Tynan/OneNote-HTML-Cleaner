import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

const fixturePath = path.resolve(process.cwd(), 'Tests', 'Test Section.one');
const fixture = fs.readFileSync(fixturePath);

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${serverHandle.baseUrl}/`, { waitUntil: 'networkidle' });

    await page.setInputFiles('#fileInput', {
      name: 'Test Section.one',
      mimeType: 'application/octet-stream',
      buffer: fixture
    });

    await page.waitForFunction(() => Array.from(document.querySelectorAll('.file-item'))
      .some((row) => /Test Section/i.test(row.textContent || '') && /partial/i.test(row.textContent || '')),
    { timeout: 8000 });

    const sectionRow = page.locator('.file-item.workbench-row', { hasText: 'Test Section' });
    await sectionRow.locator('[data-expand-id]').click();
    const pageRow = page.locator('.file-item.workbench-row', { hasText: 'Search & Tags' });
    if (await sectionRow.locator('.file-item__type').textContent() !== 'Section' || await pageRow.locator('.file-item__type').textContent() !== 'Page') {
      throw new Error('Expected native hierarchy rows to identify sections and pages');
    }
    const detailText = await page.$eval('.file-item__detail', (element) => element.textContent || '');
    if (!/Converted \d+ native page.*heuristic recovery.*Review the output before use/i.test(detailText)) {
      throw new Error(`Expected partial native conversion summary, got: ${detailText}`);
    }

    await pageRow.locator('[data-select-id]').check();
    if (await page.locator('#downloadSelected').isDisabled()) {
      throw new Error('Selecting a native page should enable Download selected');
    }

    await pageRow.locator('[data-actions-menu-trigger]').click();
    const download = pageRow.locator('[data-download-id]');
    if (await download.count() !== 1 || !/Download page ZIP/i.test(await download.textContent() || '') || !await download.getAttribute('data-native-page-path')) {
      throw new Error('Expected a page-specific native ZIP download action');
    }

    console.log('native-one-conversion-playwright: OK');
  } catch (error) {
    console.error('native-one-conversion-playwright: FAIL', error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await serverHandle.close();
  }
})();