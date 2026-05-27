import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';
import {
  enqueueWorkerManager,
  installRuntimeHarness,
  patchWorkerManagerEnqueueCapture,
  waitForWorkerManager
} from './playwright-runtime-harness.js';

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

    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait for the UI to attach the WorkerManager to the runtime object
    await waitForWorkerManager(page, 5000);

    // Patch enqueue to capture the payload that was actually posted.
    const patched = await patchWorkerManagerEnqueueCapture(page);
    if (!patched) {
      throw new Error('Failed to install workerManager enqueue capture via runtime harness');
    }

    // Dispatch a job with no id to trigger wrapper assignment
    const info = await enqueueWorkerManager(page, { type: 'probe-no-id' });

    // verify id was assigned and preserved in responses or errors
    if (!info.sent || typeof info.sent.id !== 'string') {
      throw new Error('Wrapper failed to assign id to payload: ' + JSON.stringify(info.sent));
    }
    if (info.result && info.result.id) {
      if (info.result.id !== info.sent.id) {
        throw new Error('Worker response id did not match sent id: ' + info.sent.id + ' vs ' + info.result.id);
      }
      if (info.result.originalId !== null && info.result.originalId !== undefined) {
        throw new Error('Expected originalId to be null for payload with no client id');
      }
    } else if (info.result && info.result.error && info.result.error.id) {
      if (info.result.error.id !== info.sent.id) {
        throw new Error('Worker error id did not match sent id: ' + info.sent.id + ' vs ' + info.result.error.id);
      }
    }

    // Now send a payload with an explicit client id and ensure mapping preserved
    const mapped = await enqueueWorkerManager(page, { id: 'client-123', type: 'probe-client-id' });
    if (!mapped.sent || mapped.sent.id === 'client-123') {
      throw new Error('Wrapper failed to generate new wrapperId for client-supplied id');
    }
    if (mapped.result && mapped.result.id !== mapped.sent.id) {
      throw new Error('Response id mismatch on second call');
    }
    if (mapped.result && mapped.result.originalId !== 'client-123') {
      throw new Error('originalId was not preserved: ' + mapped.result.originalId);
    }

    console.log('worker-id-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('worker-id-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
