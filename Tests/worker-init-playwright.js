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
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));
    page.on('pageerror', (err) => logs.push('PAGE ERROR: ' + (err && err.stack ? err.stack : err)));

    await page.goto(url, { waitUntil: 'networkidle' });

    // Trigger a conversion via the UI by uploading a small MHTML-like file to the hidden file input
    await page.setInputFiles('#fileInput', {
      name: 'test.mht',
      mimeType: 'multipart/related',
      buffer: Buffer.from('dummy')
    });

    // Wait for logs that show wrapper sent `init` and worker posted `ready`
    const start = Date.now();
    let passed = false;
    while (Date.now() - start < 10000) {
      const sentInitIndex = logs.findIndex(l => /\[worker-wrapper\].*sending init to worker/.test(l));
      const readyIndex = logs.findIndex(l => /\[worker\] posted ready/.test(l) || /\[worker-wrapper\].*received ready/.test(l));
      const postIndex = logs.findIndex(l => /\[worker-wrapper\].*posting message to worker/.test(l) || /\[worker\] received job/.test(l));
      if (sentInitIndex >= 0 && readyIndex >= 0 && postIndex >= 0) {
        // Ensure init -> ready -> post ordering
        if (sentInitIndex < readyIndex && readyIndex < postIndex) {
          passed = true;
          break;
        } else {
          throw new Error('Init/ready/post ordering violated. Logs:\n' + logs.join('\n'));
        }
      }
      await new Promise(r => setTimeout(r, 100));
    }

    if (!passed) throw new Error('Timeout waiting for init/ready/post sequence. Collected logs:\n' + logs.join('\n'));

    console.log('worker-init-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('worker-init-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
