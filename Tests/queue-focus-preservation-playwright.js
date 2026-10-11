import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

async function snapshotQueue(page) {
  return page.evaluate(() => ({
    hasFocus: document.hasFocus(),
    visibilityState: document.visibilityState,
    badge: document.getElementById('appStateBadge')?.textContent?.trim() || '',
    rows: Array.from(document.querySelectorAll('.file-item')).map((row) => row.textContent.replace(/\s+/g, ' ').trim()),
    lifecycleEvents: Array.isArray(window.__queueProbeEvents) ? [...window.__queueProbeEvents] : [],
    navigationType: performance.getEntriesByType('navigation')[0]?.type || 'unknown'
  }));
}

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
    const lifecycleEvents = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) lifecycleEvents.push(`playwright:framenavigated:${frame.url()}`);
    });
    page.on('load', () => lifecycleEvents.push('playwright:load'));
    page.on('domcontentloaded', () => lifecycleEvents.push('playwright:domcontentloaded'));

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.__queueProbeEvents = [];
      const record = (eventName) => {
        window.__queueProbeEvents.push(`${eventName}:${document.visibilityState}:${document.hasFocus()}`);
      };
      ['visibilitychange', 'focus', 'blur', 'pageshow', 'pagehide', 'beforeunload', 'unload'].forEach((eventName) => {
        window.addEventListener(eventName, () => record(eventName), { capture: true });
      });
      record('probe-ready');
    });
    await page.waitForSelector('#fileInput');
    await page.setInputFiles('#fileInput', [
      {
        name: 'focus-probe-one.mht',
        mimeType: 'multipart/related',
        buffer: Buffer.from('dummy')
      },
      {
        name: 'focus-probe-two.mht',
        mimeType: 'multipart/related',
        buffer: Buffer.from('dummy')
      }
    ]);

    await page.waitForFunction(() => {
      return document.querySelectorAll('.file-item').length === 2;
    }, { timeout: 5000 });

    const before = await snapshotQueue(page);

    const otherPage = await context.newPage();
    await otherPage.goto('about:blank', { waitUntil: 'load' });
    await otherPage.bringToFront();
    await page.waitForTimeout(250);
    const blurred = await snapshotQueue(page);

    await page.bringToFront();
    await page.waitForTimeout(250);
    const after = await snapshotQueue(page);

    const beforeRows = JSON.stringify(before.rows);
    const afterRows = JSON.stringify(after.rows);
    if (beforeRows !== afterRows || before.badge !== after.badge) {
      throw new Error(`Queue changed across blur/focus. before=${beforeRows} after=${afterRows} beforeBadge=${before.badge} afterBadge=${after.badge}`);
    }

    const firstTrigger = page.locator('[data-actions-menu-trigger]').first();
    await firstTrigger.focus();
    await page.keyboard.press('ArrowDown');
    const keyboardMenuState = await page.evaluate(() => ({
      expanded: document.querySelector('[data-actions-menu-trigger]')?.getAttribute('aria-expanded'),
      menuRole: document.querySelector('[role="menu"]')?.getAttribute('role'),
      activeRole: document.activeElement?.getAttribute('role')
    }));
    if (keyboardMenuState.expanded !== 'true' || keyboardMenuState.menuRole !== 'menu' || keyboardMenuState.activeRole !== 'menuitem') {
      throw new Error(`Expected ArrowDown to open the actions menu and focus a menu item, got ${JSON.stringify(keyboardMenuState)}`);
    }

    await page.keyboard.press('Escape');
    const focusAfterEscape = await page.evaluate(() => document.activeElement?.hasAttribute('data-actions-menu-trigger'));
    if (!focusAfterEscape) {
      throw new Error('Expected Escape to restore focus to the actions-menu trigger');
    }

    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.file-item').length === 1, { timeout: 5000 });
    const focusAfterFirstRemoval = await page.evaluate(() => document.activeElement?.hasAttribute('data-actions-menu-trigger'));
    if (!focusAfterFirstRemoval) {
      throw new Error('Expected Remove to move focus to the next row actions-menu trigger');
    }

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.file-item').length === 0, { timeout: 5000 });
    const focusAfterFinalRemoval = await page.evaluate(() => document.activeElement?.id);
    if (focusAfterFinalRemoval !== 'statusPanel') {
      throw new Error(`Expected final Remove to move focus to the Results panel, got ${focusAfterFinalRemoval || 'none'}`);
    }

    console.log('queue-focus-preservation-playwright: OK', JSON.stringify({ before, blurred, after, lifecycleEvents }));
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('queue-focus-preservation-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();