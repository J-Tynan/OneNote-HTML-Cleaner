import path from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

async function getRowTexts(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.file-item')).map((row) => row.textContent.replace(/\s+/g, ' ').trim()));
}

async function waitForDraftWithTwoEntries(page) {
  await page.waitForFunction(async () => {
    const instanceId = sessionStorage.getItem('oncHomepageDraftInstance');
    if (!instanceId) return false;

    return await new Promise((resolve) => {
      const request = indexedDB.open('onc-homepage-drafts', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('drafts', 'readonly');
        const getRequest = tx.objectStore('drafts').get(instanceId);
        getRequest.onsuccess = () => {
          const draft = getRequest.result;
          resolve(Boolean(
            draft
            && draft.autoConvertEnabled === false
            && Array.isArray(draft.queue)
            && draft.queue.length === 2
            && draft.queue.some((entry) => entry.name === 'Test File.mht' && entry.status === 'success')
            && draft.queue.some((entry) => entry.name === 'Dental Appointment.mht' && entry.status === 'queued')
          ));
        };
        getRequest.onerror = () => resolve(false);
      };
      request.onerror = () => resolve(false);
    });
  }, { timeout: 10000 });
}

async function getDraftSummary(page) {
  return page.evaluate(async () => {
    const instanceId = sessionStorage.getItem('oncHomepageDraftInstance');
    if (!instanceId) return { instanceId: null, queue: null };

    const draft = await new Promise((resolve) => {
      const request = indexedDB.open('onc-homepage-drafts', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('drafts', 'readonly');
        const getRequest = tx.objectStore('drafts').get(instanceId);
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });

    return {
      instanceId,
      queue: Array.isArray(draft?.queue)
        ? draft.queue.map((entry) => ({
          name: entry.name,
          status: entry.status,
          hasFile: entry.file instanceof File
        }))
        : null
    };
  });
}

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#fileInput');

    await page.setInputFiles('#fileInput', path.resolve('Tests', 'Test File.mht'));

    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('.file-item')).some((row) => {
        const text = row.textContent || '';
        return text.includes('Test File.mht') && text.toLowerCase().includes('success');
      });
    }, { timeout: 15000 });

    await page.evaluate(() => {
      const input = document.getElementById('autoConvertEnabled');
      if (!(input instanceof HTMLInputElement)) throw new Error('autoConvertEnabled missing');
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.setInputFiles('#fileInput', path.resolve('Tests', 'Dental Appointment.mht'));

    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.file-item')).map((row) => row.textContent || '');
      return rows.length === 2
        && rows.some((text) => text.includes('Test File.mht') && text.toLowerCase().includes('success'))
        && rows.some((text) => text.includes('Dental Appointment.mht') && text.toLowerCase().includes('queued'));
    }, { timeout: 10000 });

    await waitForDraftWithTwoEntries(page);

    await page.reload({ waitUntil: 'networkidle' });

    try {
      await page.waitForFunction(() => {
        const rows = Array.from(document.querySelectorAll('.file-item')).map((row) => row.textContent || '');
        return rows.length === 2
          && rows.some((text) => text.includes('Test File.mht') && text.toLowerCase().includes('success'))
          && rows.some((text) => text.includes('Dental Appointment.mht') && text.toLowerCase().includes('queued'));
      }, { timeout: 15000 });
    } catch (waitErr) {
      const debugRows = await getRowTexts(page);
      const debugBadge = await page.$eval('#appStateBadge', (node) => node.textContent.trim());
      const draftSummary = await getDraftSummary(page);
      throw new Error(`Restore mismatch after reload. badge=${debugBadge} rows=${JSON.stringify(debugRows)} draft=${JSON.stringify(draftSummary)} cause=${waitErr && waitErr.message ? waitErr.message : String(waitErr)}`);
    }

    const rowTexts = await getRowTexts(page);
    const convertEnabled = await page.$eval('#convertButton', (button) => !button.disabled);
    const badge = await page.$eval('#appStateBadge', (node) => node.textContent.trim());

    if (!convertEnabled) {
      throw new Error(`Expected Convert button to be enabled after restore. rows=${JSON.stringify(rowTexts)}`);
    }

    if (badge !== 'Queued') {
      throw new Error(`Expected queued badge after restore. badge=${badge} rows=${JSON.stringify(rowTexts)}`);
    }

    console.log('queue-reload-restore-playwright: OK', JSON.stringify({ badge, rowTexts }));
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('queue-reload-restore-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();