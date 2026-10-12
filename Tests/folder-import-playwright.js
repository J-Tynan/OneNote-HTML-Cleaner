import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });

    const inputContract = await page.$eval('#folderInput', (input) => ({
      multiple: input.multiple,
      accepts: input.getAttribute('accept'),
      directory: input.hasAttribute('webkitdirectory') && input.hasAttribute('directory')
    }));
    if (!inputContract.multiple || inputContract.accepts !== '.mht,.mhtml' || !inputContract.directory) {
      throw new Error(`Unexpected folder input contract: ${JSON.stringify(inputContract)}`);
    }

    const chooserPromise = page.waitForEvent('filechooser');
    await page.click('#folderImportButton');
    const chooser = await chooserPromise;
    const chooserId = await chooser.element().getAttribute('id');
    if (chooserId !== 'folderInput') {
      throw new Error(`Expected Add from folder to open #folderInput, got ${String(chooserId)}`);
    }

    const tree = await page.evaluate(async () => {
      const module = await import('/src/ui.js');
      const file = new File(['From folder'], 'Agenda.mht', { type: 'multipart/related' });
      Object.defineProperty(file, 'webkitRelativePath', {
        configurable: true,
        value: 'Planning/October/Agenda.mht'
      });
      module.addFilesToQueue([file]);
      return module.getWorkbenchState().tree;
    });

    const nodeIds = tree.nodes.map((node) => node.id).sort();
    const entry = tree.nodes.find((node) => node.id.startsWith('entry-'));
    if (!nodeIds.includes('folder-Planning') || !nodeIds.includes('folder-Planning-October')) {
      throw new Error(`Expected folder hierarchy from relative path, got ${JSON.stringify(nodeIds)}`);
    }
    if (!entry || entry.relativePath !== 'Planning/October/Agenda.mht') {
      throw new Error(`Expected preserved relative path, got ${JSON.stringify(entry)}`);
    }

    console.log('folder-import-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (error) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('folder-import-playwright: FAIL', error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();