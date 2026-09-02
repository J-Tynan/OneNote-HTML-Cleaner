import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { startRouteServer } from './playwright-server-helper.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const injectorPath = path.resolve(process.cwd(), 'src', 'pipeline', 'toolbarInjector.js');
  const injector = await import(pathToFileURL(injectorPath).href);

  const base = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Converted Page</title></head><body><main><h1>Converted</h1><h2 id="summary-heading" style="color:#1E4E79">Summary</h2><ul><li id="study-question" style="color:#000000">Study Questions</li></ul><p><span id="code-red" style="color:#c00000; background: white">var</span><span id="code-blue" style="color:#1861A7; background: white">\"Hello\"</span></p><p>Body</p></main></body></html>';
  const withToolbarBase = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Converted Page</title></head><body><main><h1>Converted</h1><p>Body</p></main></body></html>';

  const standardHtml = injector.injectConvertedPageThemeToggle(base, {
    ConvertedPageThemeToggleEnabled: true,
    ExperimentalExportEnabled: false,
    ExportFormat: 'html'
  });

  const toolbarInjected = injector.injectOutputToolbar(withToolbarBase, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline',
    SourceName: 'Sample.mht',
    SourceKind: 'mht',
    Profile: 'onenote',
    WarningSummary: { total: 0, info: 0, warning: 0, error: 0 }
  });

  const toolbarHtml = injector.injectConvertedPageThemeToggle(toolbarInjected, {
    ConvertedPageThemeToggleEnabled: true,
    ExperimentalExportEnabled: false,
    ExportFormat: 'html'
  });

  const serverHandle = await startRouteServer({
    '/standard': standardHtml,
    '/toolbar': toolbarHtml
  });
  const baseUrl = serverHandle.baseUrl;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${baseUrl}/standard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#onc-converted-theme-toggle');

    await page.evaluate(() => {
      try { localStorage.setItem('onc:converted-theme:' + location.pathname, 'light'); } catch (_err) {}
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#onc-converted-theme-toggle');

    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-onc-converted-theme'));
    assert(initialTheme === 'light', 'Expected default converted-page theme to be light');
    const initialIcon = await page.textContent('#onc-converted-theme-toggle');
    assert((initialIcon || '').trim() === '🔆', `Expected light-theme toggle icon to be 🔆, got ${(initialIcon || '').trim()}`);
    const initialToggleChrome = await page.evaluate(() => {
      const toggle = document.getElementById('onc-converted-theme-toggle');
      if (!toggle) return { borderTopWidth: '', backgroundColor: '' };
      const style = getComputedStyle(toggle);
      return { borderTopWidth: style.borderTopWidth, backgroundColor: style.backgroundColor };
    });
    assert(initialToggleChrome.borderTopWidth === '0px', `Expected icon-only toggle with no border, got ${initialToggleChrome.borderTopWidth}`);

    await page.click('#onc-converted-theme-toggle');
    const blackTheme = await page.evaluate(() => document.documentElement.getAttribute('data-onc-converted-theme'));
    assert(blackTheme === 'black', 'Expected converted-page theme to switch to black on click');
    const blackIcon = await page.textContent('#onc-converted-theme-toggle');
    assert((blackIcon || '').trim() === '🌑', `Expected black-theme toggle icon to be 🌑, got ${(blackIcon || '').trim()}`);

    const blackState = await page.evaluate(() => {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const heading = document.getElementById('summary-heading');
      const question = document.getElementById('study-question');
      const redToken = document.getElementById('code-red');
      const blueToken = document.getElementById('code-blue');
      return {
        bodyBg,
        headingColor: heading ? getComputedStyle(heading).color : '',
        questionColor: question ? getComputedStyle(question).color : '',
        redTokenColor: redToken ? getComputedStyle(redToken).color : '',
        redTokenBg: redToken ? getComputedStyle(redToken).backgroundColor : '',
        blueTokenColor: blueToken ? getComputedStyle(blueToken).color : '',
        blueTokenBg: blueToken ? getComputedStyle(blueToken).backgroundColor : ''
      };
    });

    assert(blackState.bodyBg === 'rgb(0, 0, 0)', `Expected black-theme body background to be black, got ${blackState.bodyBg}`);
    assert(blackState.questionColor === 'rgb(214, 214, 207)', `Expected Study Questions text to recolor in black theme, got ${blackState.questionColor}`);
    assert(blackState.redTokenColor === 'rgb(192, 0, 0)', `Expected red syntax token color to be preserved, got ${blackState.redTokenColor}`);
    assert(blackState.blueTokenColor === 'rgb(24, 97, 167)', `Expected blue syntax token color to be preserved, got ${blackState.blueTokenColor}`);
    assert(blackState.redTokenBg === 'rgba(0, 0, 0, 0)', `Expected red syntax token white background to be cleared, got ${blackState.redTokenBg}`);
    assert(blackState.blueTokenBg === 'rgba(0, 0, 0, 0)', `Expected blue syntax token white background to be cleared, got ${blackState.blueTokenBg}`);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#onc-converted-theme-toggle');
    const persistedTheme = await page.evaluate(() => document.documentElement.getAttribute('data-onc-converted-theme'));
    assert(persistedTheme === 'black', 'Expected converted-page theme to persist per file via localStorage');

    await page.goto(`${baseUrl}/toolbar`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#onc-converted-theme-toggle');
    await page.waitForSelector('#onenote-cleaner-toolbar', { state: 'attached' });
    await page.waitForFunction(() => {
      const root = document.getElementById('onenote-cleaner-toolbar');
      return Boolean(root && root.dataset && root.dataset.oncInitialized === '1');
    });

    const defaultHiddenLayout = await page.evaluate(() => {
      const toolbar = document.getElementById('onenote-cleaner-toolbar');
      const toggle = document.getElementById('onc-converted-theme-toggle');
      const reveal = document.getElementById('onc-toolbar-show');
      const toggleRect = toggle ? toggle.getBoundingClientRect() : null;
      const revealRect = reveal ? reveal.getBoundingClientRect() : null;
      return {
        toolbarHidden: Boolean(toolbar && toolbar.hidden),
        toggleTop: toggleRect ? Math.round(toggleRect.top) : -1,
        revealTop: revealRect ? Math.round(revealRect.top) : -1
      };
    });
    assert(defaultHiddenLayout.toolbarHidden === true, 'Expected injected toolbar to be hidden by default');
    assert(defaultHiddenLayout.toggleTop <= 24, `Expected default toggle near top when toolbar hidden, got ${defaultHiddenLayout.toggleTop}`);
    assert(Math.abs(defaultHiddenLayout.toggleTop - defaultHiddenLayout.revealTop) <= 6, `Expected Toolbar reveal button to align with toggle by default, toggleTop=${defaultHiddenLayout.toggleTop} revealTop=${defaultHiddenLayout.revealTop}`);

    await page.click('#onc-toolbar-show');

    const topOffset = await page.evaluate(() => {
      const toggle = document.getElementById('onc-converted-theme-toggle');
      const top = toggle ? getComputedStyle(toggle).top : '0px';
      return Number.parseFloat(top || '0');
    });

    assert(topOffset > defaultHiddenLayout.toggleTop, `Expected converted-page theme toggle to move down when toolbar is shown, default=${defaultHiddenLayout.toggleTop} shown=${topOffset}`);

    await page.click('#onc-converted-theme-toggle');
    const toolbarBlackState = await page.evaluate(() => {
      const toolbar = document.getElementById('onenote-cleaner-toolbar');
      const style = toolbar ? getComputedStyle(toolbar) : null;
      return {
        bg: style ? style.backgroundColor : '',
        color: style ? style.color : ''
      };
    });
    assert(toolbarBlackState.bg === 'rgb(0, 0, 0)', `Expected toolbar background to follow black theme, got ${toolbarBlackState.bg}`);

    const beforeExpandTop = await page.evaluate(() => {
      const toggle = document.getElementById('onc-converted-theme-toggle');
      return toggle ? Number.parseFloat(getComputedStyle(toggle).top || '0') : 0;
    });
    await page.click('[data-onc-action="metadata-toggle"]');
    await page.waitForTimeout(50);
    const expandedTop = await page.evaluate(() => {
      const toggle = document.getElementById('onc-converted-theme-toggle');
      return toggle ? Number.parseFloat(getComputedStyle(toggle).top || '0') : 0;
    });
    assert(expandedTop > beforeExpandTop, `Expected theme toggle to move down when metadata expands, before=${beforeExpandTop} after=${expandedTop}`);

    await page.click('[data-onc-action="hide-toolbar"]');
    await page.waitForSelector('#onc-toolbar-show:not([hidden])');
    const hiddenLayout = await page.evaluate(() => {
      const toggle = document.getElementById('onc-converted-theme-toggle');
      const reveal = document.getElementById('onc-toolbar-show');
      const toolbar = document.getElementById('onenote-cleaner-toolbar');
      const toggleRect = toggle ? toggle.getBoundingClientRect() : null;
      const revealRect = reveal ? reveal.getBoundingClientRect() : null;
      return {
        toolbarHidden: Boolean(toolbar && toolbar.hidden),
        toggleTop: toggleRect ? Math.round(toggleRect.top) : -1,
        revealTop: revealRect ? Math.round(revealRect.top) : -1
      };
    });
    assert(hiddenLayout.toolbarHidden === true, 'Expected toolbar to be hidden after hide action');
    assert(hiddenLayout.toggleTop <= 24, `Expected toggle to return near top when toolbar hidden, got top=${hiddenLayout.toggleTop}`);
    assert(Math.abs(hiddenLayout.toggleTop - hiddenLayout.revealTop) <= 6, `Expected reveal button to align with toggle when hidden, toggleTop=${hiddenLayout.toggleTop} revealTop=${hiddenLayout.revealTop}`);

    await page.click('#onc-toolbar-show');
    const shownTop = await page.evaluate(() => {
      const toggle = document.getElementById('onc-converted-theme-toggle');
      const toolbar = document.getElementById('onenote-cleaner-toolbar');
      return {
        toolbarHidden: Boolean(toolbar && toolbar.hidden),
        top: toggle ? Number.parseFloat(getComputedStyle(toggle).top || '0') : 0
      };
    });
    assert(shownTop.toolbarHidden === false, 'Expected toolbar to reappear after clicking Toolbar reveal button');
    assert(shownTop.top >= 60, `Expected toggle to reposition below restored toolbar, got top=${shownTop.top}`);

    console.log('converted-page-theme-toggle-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('converted-page-theme-toggle-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
