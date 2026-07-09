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

  const base = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Communicate\nusing Markdown</title></head><body><main><h1>Converted</h1><p>Body</p></main></body></html>';

  const withToolbar = injector.injectOutputToolbar(base, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline',
    SourceName: 'Communicate using Markdown.mht',
    SourceKind: 'mht',
    Profile: 'onenote',
    WarningSummary: { total: 0, info: 0, warning: 0, error: 0 }
  });

  const serverHandle = await startRouteServer({
    '/toolbar': withToolbar
  });
  const baseUrl = serverHandle.baseUrl;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    const saveContext = await browser.newContext();
    await saveContext.addInitScript(() => {
      window.__oncSave = { calls: 0, writes: 0, closes: 0, suggestedName: '' };
      window.showSaveFilePicker = async (options = {}) => {
        window.__oncSave.calls += 1;
        window.__oncSave.suggestedName = options.suggestedName || '';
        return {
          async createWritable() {
            return {
              async write() { window.__oncSave.writes += 1; },
              async close() { window.__oncSave.closes += 1; }
            };
          }
        };
      };
    });

    const savePage = await saveContext.newPage();
    await savePage.goto(`${baseUrl}/toolbar`, { waitUntil: 'networkidle' });
    await savePage.waitForSelector('#onenote-cleaner-toolbar', { state: 'attached' });
    await savePage.click('#onc-toolbar-show');
    await savePage.click('[data-onc-action="save"]');

    const saveStats = await savePage.evaluate(() => window.__oncSave);
    assert(saveStats.calls === 1, `Expected save picker to be called once, got ${saveStats.calls}`);
    assert(saveStats.writes === 1, `Expected one write after Save, got ${saveStats.writes}`);
    assert(saveStats.closes === 1, `Expected one close after Save, got ${saveStats.closes}`);
    assert(saveStats.suggestedName === 'Communicate using Markdown.html', `Expected normalized suggested file name, got ${saveStats.suggestedName}`);

    const cancelContext = await browser.newContext();
    await cancelContext.addInitScript(() => {
      window.__oncCancel = { calls: 0, writes: 0 };
      window.showSaveFilePicker = async () => {
        window.__oncCancel.calls += 1;
        const error = new Error('The user aborted a request.');
        error.name = 'AbortError';
        throw error;
      };
      const nativeCreateObjectUrl = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        window.__oncCancel.writes += 1;
        return nativeCreateObjectUrl(blob);
      };
    });

    const cancelPage = await cancelContext.newPage();
    await cancelPage.goto(`${baseUrl}/toolbar`, { waitUntil: 'networkidle' });
    await cancelPage.waitForSelector('#onenote-cleaner-toolbar', { state: 'attached' });
    await cancelPage.click('#onc-toolbar-show');
    await cancelPage.click('[data-onc-action="save"]');
    await cancelPage.waitForTimeout(50);

    const cancelStats = await cancelPage.evaluate(() => window.__oncCancel);
    assert(cancelStats.calls === 1, `Expected save picker to be called once on cancel path, got ${cancelStats.calls}`);
    assert(cancelStats.writes === 0, `Expected no fallback download/write on cancel, got ${cancelStats.writes}`);

    await saveContext.close();
    await cancelContext.close();
    await browser.close();
    await serverHandle.close();
    console.log('toolbar-save-playwright: OK');
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('toolbar-save-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
