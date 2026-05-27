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

    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));
    page.on('pageerror', (err) => logs.push('PAGE ERROR: ' + (err && err.stack ? err.stack : err)));

    // Intercept the worker's dynamic import of pipeline.js and force it to throw
    await page.route('**/src/pipeline/pipeline.js', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'throw new Error("simulated import failure"); export function runPipeline() { return { output: "", logs: [] }; }'
      });
    });

    await page.goto(url, { waitUntil: 'networkidle' });

    // Trigger a conversion via the UI by uploading a small MHTML-like file to the hidden file input
    await page.setInputFiles('#fileInput', {
      name: 'test.mht',
      mimeType: 'multipart/related',
      buffer: Buffer.from('dummy')
    });

    // Wait for the expected sequence: init sent -> init() started -> imports failed -> ready -> job error.
    // The current worker contract also records an init-import diagnostic in the wrapper buffer.
    const start = Date.now();
    let passed = false;
    while (Date.now() - start < 10000) {
      const diagnostics = await getWorkerDiagnostics(page);
      const sentInitIndex = logs.findIndex(l => /\[worker-wrapper\].*sending init to worker/.test(l));
      const initStartedIndex = logs.findIndex(l => /\[worker\].*init\(\)/.test(l));
      const importsFailedIndex = logs.findIndex(l => /imports failed during init\(\)/.test(l));
      const readyIndex = logs.findIndex(l => /\[worker\] posted ready/.test(l) || /\[worker-wrapper\].*received ready/.test(l));
      const jobErrorIndex = logs.findIndex(l => /pipeline not available in worker/.test(l) || /worker processing error/.test(l));
      const initImportDiagnostic = diagnostics.find((d) => d && d.payload && d.payload.phase === 'init-imports');

      if (sentInitIndex >= 0 && initStartedIndex >= 0 && importsFailedIndex >= 0 && readyIndex >= 0 && jobErrorIndex >= 0 && initImportDiagnostic) {
        // Ensure ordering: sentInit < initStarted < importsFailed < ready < jobError
        if (sentInitIndex < initStartedIndex && initStartedIndex < importsFailedIndex && importsFailedIndex < readyIndex && readyIndex < jobErrorIndex) {
          passed = true;
          break;
        } else {
          throw new Error('Observed init-failure signals but ordering incorrect:\n' + logs.join('\n'));
        }
      }
      await new Promise(r => setTimeout(r, 100));
    }

    if (!passed) throw new Error('Timeout waiting for init-failure sequence. Collected logs:\n' + logs.join('\n'));

    console.log('worker-init-failure-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('worker-init-failure-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();