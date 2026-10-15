import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

const desktopViewport = { width: 1366, height: 900 };
const screenshotDirectory = path.join(process.cwd(), 'test-results', 'homepage-visual');

async function captureState(browser, url, name, setup) {
  const context = await browser.newContext({ viewport: desktopViewport });
  const page = await context.newPage();

  try {
    await setup(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(screenshotDirectory, `${name}-desktop.png`) });
  } finally {
    await context.close();
  }
}

async function captureQueuedState(browser, url) {
  const context = await browser.newContext({ viewport: desktopViewport });
  const page = await context.newPage();

  try {
    await page.addInitScript(() => localStorage.setItem('autoConvertEnabled', 'false'));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.setInputFiles('#fileInput', {
      name: 'quarterly-planning-notes.mht',
      mimeType: 'multipart/related',
      buffer: Buffer.from('MHT fixture for visual review')
    });
    await page.waitForFunction(() => document.querySelector('.file-item__status')?.textContent?.includes('queued'));
    await page.screenshot({ path: path.join(screenshotDirectory, 'queued-desktop.png') });
  } finally {
    await context.close();
  }
}

async function captureCompletedAndSelectedStates(browser, url) {
  const context = await browser.newContext({ viewport: desktopViewport });
  const page = await context.newPage();

  try {
    await page.addInitScript(() => localStorage.setItem('autoConvertEnabled', 'false'));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.setInputFiles('#fileInput', {
      name: 'project-plan.mhtml',
      mimeType: 'multipart/related',
      buffer: Buffer.from('MHTML fixture for visual review')
    });
    await page.waitForSelector('#convertButton:not([disabled])');
    await page.click('#convertButton');
    await page.waitForSelector('[data-download-id]', { state: 'attached', timeout: 8000 });
    await page.screenshot({ path: path.join(screenshotDirectory, 'completed-desktop.png') });

    await page.locator('.workbench-select').check();
    await page.waitForFunction(() => !document.getElementById('downloadSelected')?.disabled);
    await page.screenshot({ path: path.join(screenshotDirectory, 'selected-desktop.png') });
  } finally {
    await context.close();
  }
}

async function captureUnsupportedState(browser, url) {
  const context = await browser.newContext({ viewport: desktopViewport });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.setInputFiles('#fileInput', {
      name: 'native-note.one',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('Native OneNote fixture for unsupported-state review')
    });
    await page.waitForFunction(() => document.querySelector('.file-item__status')?.textContent?.includes('Unsupported'));
    await page.screenshot({ path: path.join(screenshotDirectory, 'unsupported-desktop.png') });
  } finally {
    await context.close();
  }
}

async function captureResponsiveEmptyStates(browser, url) {
  const responsiveStates = [
    { name: 'empty-tablet', viewport: { width: 820, height: 1180 } },
    { name: 'empty-mobile', viewport: { width: 390, height: 844 } }
  ];

  for (const { name, viewport } of responsiveStates) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(screenshotDirectory, `${name}.png`) });
    } finally {
      await context.close();
    }
  }
}

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;
  let browser;

  try {
    await fs.mkdir(screenshotDirectory, { recursive: true });
    browser = await chromium.launch({ headless: true });

    await captureState(browser, url, 'empty', async () => {});
    await captureQueuedState(browser, url);
    await captureCompletedAndSelectedStates(browser, url);
    await captureUnsupportedState(browser, url);
    await captureResponsiveEmptyStates(browser, url);

    const expectedScreenshots = [
      'empty-desktop',
      'queued-desktop',
      'completed-desktop',
      'selected-desktop',
      'unsupported-desktop',
      'empty-tablet',
      'empty-mobile'
    ];
    const missingScreenshots = [];
    for (const name of expectedScreenshots) {
      const screenshot = path.join(screenshotDirectory, `${name}.png`);
      const metadata = await fs.stat(screenshot);
      if (metadata.size === 0) missingScreenshots.push(name);
    }
    if (missingScreenshots.length > 0) {
      throw new Error(`Missing visual screenshots: ${missingScreenshots.join(', ')}`);
    }

    console.log(`homepage-workbench-visual-playwright: OK (${screenshotDirectory})`);
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (error) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('homepage-workbench-visual-playwright: FAIL', error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();