import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';
import { getWorkerDiagnostics, installRuntimeHarness } from './playwright-runtime-harness.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    await installRuntimeHarness(ctx);
    const page = await ctx.newPage();

    page.on('pageerror', (err) => console.error('PAGE ERROR:', err && err.stack ? err.stack : err));
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

    // Force the worker's pipeline import to fail so worker-globals posts an `init` diagnostic
    await page.route('**/src/pipeline/pipeline.js', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'throw new Error("simulated pipeline import failure for diagnostics test"); export function runPipeline() { return { output: "", logs: [] }; }'
      });
    });

    await page.goto(url, { waitUntil: 'networkidle' });

    // Add a small file to the queue so the status panel (which contains the
    // diagnostics panel) becomes visible — diagnostics are shown inside the
    // status area.
    await page.setInputFiles('#fileInput', {
      name: 'probe.mht',
      mimeType: 'multipart/related',
      buffer: Buffer.from('dummy')
    });

    // Wait for the worker to post diagnostics (verify via the runtime helper)
    let diags = [];
    for (let i = 0; i < 10; i++) {
      diags = await getWorkerDiagnostics(page);
      if (diags && diags.length) break;
      await new Promise(r => setTimeout(r, 200));
    }
    if (!diags || !diags.length) throw new Error('No diagnostics found in WorkerManager after init failure');

    // Assert structured diagnostic is present (worker-origin or unmatched-message)
    const hasInitDiagnostic = diags.some((d) => {
      try {
        if (d.kind === 'worker-diagnostic' && d.payload) {
          const p = d.payload;
          return p.id === 'init' || p.phase === 'init-imports' || (p.msg && /init/.test(p.msg));
        }
        if (d.kind === 'unmatched-message') {
          return d.id === 'init' || /init/.test(d.preview || '');
        }
        if (d && d.id === 'init') return true;
        if (d && d.payload && d.payload.id === 'init') return true;
      } catch (e) {
        return false;
      }
      return false;
    });
    if (!hasInitDiagnostic) throw new Error('Expected structured init diagnostic in WorkerManager diagnostics: ' + JSON.stringify(diags, null, 2));

    // Now the UI diagnostics panel should reflect the diagnostic (structured JSON rendered)
    await page.waitForSelector('#diagnosticsPanel:not(.hidden)', { timeout: 5000 });
    // Expand the details panel to reveal diagnostics list
    await page.click('#diagnosticsPanel summary');
    const diagnosticsHtml = await page.evaluate(() => document.getElementById('diagnosticsList').innerHTML);
    if (!/"id"\s*:\s*"init"/.test(diagnosticsHtml) && !/init-imports/.test(diagnosticsHtml) && !/unmatched-message/.test(diagnosticsHtml)) {
      throw new Error('Expected init diagnostic in UI diagnostics list (structured), got: ' + diagnosticsHtml);
    }

    console.log('worker-diagnostics-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('worker-diagnostics-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();