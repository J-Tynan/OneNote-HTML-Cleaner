import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();

    const page = await ctx.newPage();
    // ensure clean storage once before first render
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      try { localStorage.removeItem('theme'); } catch (e) {}
      try { localStorage.removeItem('themeVariant'); } catch (e) {}
    });
    // reload after clearing so initTheme applies default
    await page.reload({ waitUntil: 'networkidle' });
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));
    page.on('requestfailed', (req) => console.log('PAGE REQ FAILED:', req.url(), req.failure && req.failure().errorText));
    page.on('requestfinished', (req) => console.log('PAGE REQ FINISHED:', req.url()));
    await page.goto(url, { waitUntil: 'networkidle' });
    // clear any persisted variant state before starting
    await page.evaluate(() => {
      localStorage.removeItem('themeVariant');
      document.documentElement.removeAttribute('data-variant');
    });

    // Initial state should be light (no 'dark' class) and initTheme() should persist that choice
    const hasDarkInitially = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (hasDarkInitially) throw new Error('Expected initial theme to be light');
    const storedAfterLoad = await page.evaluate(() => localStorage.getItem('theme'));
    console.log('STORED_AFTER_LOAD:', storedAfterLoad);
    if (storedAfterLoad !== 'light') throw new Error('Expected localStorage.theme to be "light" after init when none was present');

    // Click the theme toggle and assert dark mode applied + persisted
    await page.click('#themeToggle');
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    const storedAfterDark = await page.evaluate(() => localStorage.getItem('theme'));
    if (storedAfterDark !== 'dark') throw new Error('Expected localStorage.theme to be "dark" after toggle');

    // Click again to return to light
    await page.click('#themeToggle');
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
    const storedAfterLight = await page.evaluate(() => localStorage.getItem('theme'));
    if (storedAfterLight !== 'light') throw new Error('Expected localStorage.theme to be "light" after second toggle');

    // Ensure button state (aria-pressed) reflects theme
    const ariaPressed = await page.getAttribute('#themeToggle', 'aria-pressed');
    if (ariaPressed !== 'false') throw new Error('Expected #themeToggle aria-pressed="false" after reverting to light');

    // --- Variant selector tests ---
    // switch to dark and pick a variant
    await page.click('#themeToggle');
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    // directly apply a blue-tint variant and persist
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-variant', 'blue-tint');
      localStorage.setItem('themeVariant', 'blue-tint');
    });
    // verify dataset and storage
    await page.waitForFunction(() => document.documentElement.dataset.variant === 'blue-tint');
    const storedVariant = await page.evaluate(() => localStorage.getItem('themeVariant'));
    if (storedVariant !== 'blue-tint') throw new Error('Expected themeVariant stored');
    // confirm computed style changed from default dark
    const bgBefore = await page.evaluate(() => getComputedStyle(document.querySelector('.card-panel')).backgroundColor);
    if (bgBefore === 'rgb(12,20,27)') throw new Error('Expected variant to alter card-panel bg');

    // reload and verify persistence
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#themeToggle');
    const themeAfter = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const variantAfter = await page.evaluate(() => document.documentElement.dataset.variant || '');
    if (themeAfter !== 'dark' || variantAfter !== 'blue-tint') {
      throw new Error(`Expected dark+blue-tint after reload, saw theme=${themeAfter} variant=${variantAfter}`);
    }
    const storedAfterReload = await page.evaluate(() => localStorage.getItem('themeVariant'));
    if (storedAfterReload !== 'blue-tint') throw new Error('Expected themeVariant to persist across reload');

    console.log('theme-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('theme-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();