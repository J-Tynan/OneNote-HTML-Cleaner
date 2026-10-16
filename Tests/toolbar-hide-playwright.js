import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { startRouteServer } from './playwright-server-helper.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const VIEWPORTS = [
  { name: 'narrow-phone', width: 320, height: 740 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 960 }
];
const STYLE_VALUES = ['page-title', 'heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6', 'citation', 'quote', 'code', 'normal'];

(async () => {
  const injectorPath = path.resolve(process.cwd(), 'src', 'pipeline', 'toolbarInjector.js');
  const injector = await import(pathToFileURL(injectorPath).href);
  const base = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Toolbar</title></head><body><main><h1>Converted</h1><p>Body</p></main></body></html>';
  const toolbarHtml = injector.injectOutputToolbar(base, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline',
    SourceName: 'Sample.mht',
    SourceKind: 'mht'
  });
  const pageHtml = injector.injectConvertedPageThemeToggle(toolbarHtml, {
    ConvertedPageThemeToggleEnabled: true,
    ExperimentalExportEnabled: false,
    ExportFormat: 'html'
  });
  const serverHandle = await startRouteServer({ '/toolbar': pageHtml });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: viewport.name === 'narrow-phone'
      });
      const page = await context.newPage();
      await page.goto(`${serverHandle.baseUrl}/toolbar`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.getElementById('onenote-cleaner-toolbar')?.dataset.oncInitialized === '1');

      const initial = await page.evaluate(() => {
        const root = document.getElementById('onenote-cleaner-toolbar');
        return {
          hidden: Boolean(root?.hidden),
          preset: root?.getAttribute('data-onc-toolbar-preset') || '',
          viewportOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      });
      assert(initial.hidden, `Expected toolbar to start hidden at ${viewport.name}`);
      assert(initial.preset === '', `Did not expect a preset marker at ${viewport.name}`);
      assert(!initial.viewportOverflow, `Expected no initial horizontal overflow at ${viewport.name}`);

      await page.click('#onc-toolbar-show');
      const visible = await page.evaluate(() => {
        const root = document.getElementById('onenote-cleaner-toolbar');
        const select = root?.querySelector('[data-onc-role="style-select"]');
        const moreTools = root?.querySelector('[data-onc-role="more-tools"]');
        const firstButton = root?.querySelector('.onc-btn');
        const rootRect = root?.getBoundingClientRect();
        const buttonRect = firstButton?.getBoundingClientRect();
        return {
          hidden: Boolean(root?.hidden),
          editToolsVisible: Boolean(root?.querySelector('[data-onc-role="edit-tools"]') && !root?.querySelector('[data-onc-role="edit-tools"]')?.hidden),
          hasMoreTools: Boolean(moreTools),
          moreOpen: Boolean(moreTools?.open),
          styleValues: select ? Array.from(select.options).map((option) => option.value) : [],
          rootRight: rootRect?.right || 0,
          buttonHeight: buttonRect?.height || 0,
          viewportOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      });
      assert(!visible.hidden, `Expected toolbar visible at ${viewport.name}`);
      assert(visible.editToolsVisible, `Expected edit tools visible at ${viewport.name}`);
      assert(visible.hasMoreTools && !visible.moreOpen, `Expected secondary commands collapsed at ${viewport.name}`);
      assert(JSON.stringify(visible.styleValues) === JSON.stringify(STYLE_VALUES), `Expected full style list at ${viewport.name}`);
      assert(visible.rootRight <= viewport.width + 2, `Expected toolbar within viewport at ${viewport.name}`);
      assert(!visible.viewportOverflow, `Expected no horizontal overflow with toolbar open at ${viewport.name}`);
      if (viewport.name === 'narrow-phone') {
        assert(visible.buttonHeight >= 44, `Expected touch-sized toolbar controls at ${viewport.name}, got ${visible.buttonHeight}`);
      }

      await page.click('[data-onc-role="more-tools"] summary');
      const moreOpen = await page.evaluate(() => {
        const moreTools = document.querySelector('[data-onc-role="more-tools"]');
        return Boolean(moreTools?.open && moreTools.querySelector('[data-onc-edit-command="link"]'));
      });
      assert(moreOpen, `Expected More formatting disclosure to open at ${viewport.name}`);
      await page.keyboard.press('Escape');
      const moreClosed = await page.evaluate(() => !document.querySelector('[data-onc-role="more-tools"]')?.open);
      assert(moreClosed, `Expected Escape to close More formatting at ${viewport.name}`);

      await page.click('[data-onc-action="metadata-toggle"]');
      const metadataVisible = await page.evaluate(() => !document.querySelector('[data-onc-role="metadata-panel"]')?.hidden);
      assert(metadataVisible, `Expected metadata panel to open at ${viewport.name}`);
      await page.click('[data-onc-action="hide-toolbar"]');
      const hidden = await page.evaluate(() => Boolean(document.getElementById('onenote-cleaner-toolbar')?.hidden));
      assert(hidden, `Expected toolbar hide action to work at ${viewport.name}`);
      await context.close();
    }

    console.log('toolbar-hide-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (error) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('toolbar-hide-playwright: FAIL', error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();