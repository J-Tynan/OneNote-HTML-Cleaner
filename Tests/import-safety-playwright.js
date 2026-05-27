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

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

    await page.goto(url, { waitUntil: 'networkidle' });

    // Attempt to import key pipeline modules in the page to ensure they
    // have no import-time side-effects that throw synchronously.
    const result = await page.evaluate(async () => {
      try {
        await import('/src/pipeline/mht.js');
        await import('/src/pipeline/pipeline.js');
        await import('/src/pipeline/parser.js');
        await import('/src/pipeline/sanitize.js');
        await import('/src/pipeline/listRepair.js');
        await import('/src/pipeline/inlineStyleMigration.js');
        await import('/src/pipeline/images.js');
        await import('/src/pipeline/toolbarInjector.js');
        await import('/src/pipeline/Semantics.js');
        await import('/src/pipeline/dateTimeLayout.js');
        await import('/src/pipeline/config.js');
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err && err.stack ? err.stack : err) };
      }
    });

    if (!result.ok) throw new Error('Import-safety failed: ' + result.error);

    console.log('import-safety-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('import-safety-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();