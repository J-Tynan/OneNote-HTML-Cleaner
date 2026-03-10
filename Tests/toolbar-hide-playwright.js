import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const injectorPath = path.resolve(process.cwd(), 'src', 'pipeline', 'toolbarInjector.js');
  const injector = await import(pathToFileURL(injectorPath).href);

  const base = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Toolbar</title></head><body><main><h1 data-onc-editable="1">Converted</h1><p data-onc-editable="1">Body</p></main></body></html>';

  const withToolbar = injector.injectOutputToolbar(base, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline',
    SourceName: 'Sample.mht',
    SourceKind: 'mht',
    Profile: 'onenote',
    WarningSummary: { total: 0, info: 0, warning: 0, error: 0 }
  });

  const withToolbarAndTheme = injector.injectConvertedPageThemeToggle(withToolbar, {
    ConvertedPageThemeToggleEnabled: true,
    ConvertedPageThemeToggleOledBlack: false,
    ExperimentalExportEnabled: false,
    ExportFormat: 'html'
  });

  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (url === '/toolbar') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(withToolbarAndTheme);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.on('error', reject);
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${baseUrl}/toolbar`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#onenote-cleaner-toolbar', { state: 'attached' });
    await page.waitForSelector('#onc-converted-theme-toggle');
    await page.waitForFunction(() => {
      const root = document.getElementById('onenote-cleaner-toolbar');
      return Boolean(root && root.dataset && root.dataset.oncInitialized === '1');
    });

    const initialState = await page.evaluate(() => {
      const root = document.getElementById('onenote-cleaner-toolbar');
      const showButton = document.getElementById('onc-toolbar-show');
      return {
        toolbarHidden: Boolean(root && root.hidden),
        showVisible: Boolean(showButton && !showButton.hidden)
      };
    });
    assert(initialState.toolbarHidden === true, 'Expected toolbar to be hidden by default');
    assert(initialState.showVisible === true, 'Expected Toolbar reveal button visible by default');

    await page.click('#onc-toolbar-show');

    const shownFirstState = await page.evaluate(() => {
      const root = document.getElementById('onenote-cleaner-toolbar');
      const showButton = document.getElementById('onc-toolbar-show');
      return {
        toolbarHidden: Boolean(root && root.hidden),
        showVisible: Boolean(showButton && !showButton.hidden)
      };
    });
    assert(shownFirstState.toolbarHidden === false, 'Expected toolbar to appear when clicking Toolbar reveal button');
    assert(shownFirstState.showVisible === false, 'Expected Toolbar reveal button to hide when toolbar is visible');

    await page.click('[data-onc-action="edit-toggle"]');
    const editToolsState = await page.evaluate(() => {
      const editTools = document.querySelector('[data-onc-role="edit-tools"]');
      const editToggle = document.querySelector('[data-onc-action="edit-toggle"]');
      const hideButton = document.querySelector('[data-onc-action="hide-toolbar"]');
      const styleSelect = document.querySelector('[data-onc-role="style-select"]');
      return {
        visible: Boolean(editTools && !editTools.hidden),
        editLabel: editToggle ? (editToggle.textContent || '').trim() : '',
        hideLabel: hideButton ? (hideButton.textContent || '').trim() : '',
        styleDisabled: styleSelect ? styleSelect.disabled : true,
        styleOptions: styleSelect ? Array.from(styleSelect.options).map((option) => ({ value: option.value, label: option.textContent || '' })) : []
      };
    });
    assert(editToolsState.visible === true, 'Expected edit formatting tools to show when edit mode is enabled');
    assert(editToolsState.editLabel === 'Disable edit', `Expected edit toggle label to switch to Disable edit, got ${editToolsState.editLabel}`);
    assert(editToolsState.hideLabel === 'Hide', `Expected hide button label to be Hide, got ${editToolsState.hideLabel}`);
    assert(editToolsState.styleDisabled === false, 'Expected styles dropdown to be enabled in edit mode');
    assert(JSON.stringify(editToolsState.styleOptions.map((option) => option.value)) === JSON.stringify(['page-title', 'heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6', 'citation', 'quote', 'code', 'normal']), `Expected OneNote-style dropdown values, got ${JSON.stringify(editToolsState.styleOptions)}`);

    await page.click('p[data-onc-editable="1"]');

    await page.evaluate(() => {
      window.__oncEditProbe = { prompts: [], execCalls: [] };
      const nativePrompt = window.prompt.bind(window);
      const nativeExec = document.execCommand.bind(document);
      const nativeQueryState = document.queryCommandState ? document.queryCommandState.bind(document) : null;
      const nativeQueryValue = document.queryCommandValue ? document.queryCommandValue.bind(document) : null;
      const commandState = {
        bold: false,
        italic: false,
        formatBlock: 'p'
      };
      window.prompt = (message, defaultValue) => {
        window.__oncEditProbe.prompts.push({ message: String(message || ''), defaultValue: String(defaultValue || '') });
        if (/display text/i.test(String(message || ''))) return 'Example Link';
        if (/url/i.test(String(message || ''))) return 'https://example.com';
        return nativePrompt(message, defaultValue);
      };
      document.execCommand = (command, ui, value) => {
        const normalized = String(command || '').toLowerCase();
        const normalizedValue = value == null ? '' : String(value).toLowerCase();
        if (normalized === 'bold') commandState.bold = !commandState.bold;
        if (normalized === 'italic') commandState.italic = !commandState.italic;
        if (normalized === 'formatblock') {
          commandState.formatBlock = normalizedValue || 'p';
        }
        window.__oncEditProbe.execCalls.push({ command: String(command || ''), value: value == null ? '' : String(value), state: { ...commandState } });
        return true;
      };
      document.queryCommandState = (command) => {
        const normalized = String(command || '').toLowerCase();
        if (normalized === 'bold') return commandState.bold;
        if (normalized === 'italic') return commandState.italic;
        return false;
      };
      document.queryCommandValue = (command) => {
        if (String(command || '').toLowerCase() === 'formatblock') return commandState.formatBlock;
        return '';
      };
      window.__oncEditProbe.restore = () => {
        window.prompt = nativePrompt;
        document.execCommand = nativeExec;
        if (nativeQueryState) document.queryCommandState = nativeQueryState;
        if (nativeQueryValue) document.queryCommandValue = nativeQueryValue;
      };
    });

    await page.click('[data-onc-edit-command="bold"]');
    const boldState = await page.evaluate(() => {
      const boldButton = document.querySelector('[data-onc-edit-command="bold"]');
      return {
        ariaPressed: boldButton ? boldButton.getAttribute('aria-pressed') : null,
        activeFlag: boldButton ? boldButton.getAttribute('data-onc-active') : null
      };
    });
    assert(boldState.ariaPressed === 'true', `Expected bold button aria-pressed=true after click, got ${boldState.ariaPressed}`);
    assert(boldState.activeFlag === 'true', `Expected bold button data-onc-active=true after click, got ${boldState.activeFlag}`);

    await page.click('[data-onc-edit-command="bold"]');
    const boldOffState = await page.evaluate(() => {
      const boldButton = document.querySelector('[data-onc-edit-command="bold"]');
      return {
        ariaPressed: boldButton ? boldButton.getAttribute('aria-pressed') : null,
        activeFlag: boldButton ? boldButton.getAttribute('data-onc-active') : null
      };
    });
    assert(boldOffState.ariaPressed === 'false', `Expected bold button aria-pressed=false after second click, got ${boldOffState.ariaPressed}`);
    assert(boldOffState.activeFlag === 'false', `Expected bold button data-onc-active=false after second click, got ${boldOffState.activeFlag}`);

    await page.click('[data-onc-edit-command="bold"]');
    await page.click('[data-onc-edit-command="italic"]');
    const independentState = await page.evaluate(() => {
      const boldButton = document.querySelector('[data-onc-edit-command="bold"]');
      const italicButton = document.querySelector('[data-onc-edit-command="italic"]');
      return {
        bold: boldButton ? boldButton.getAttribute('aria-pressed') : null,
        italic: italicButton ? italicButton.getAttribute('aria-pressed') : null
      };
    });
    assert(independentState.bold === 'true', `Expected bold to remain enabled when italic is enabled, got ${independentState.bold}`);
    assert(independentState.italic === 'true', `Expected italic to enable independently, got ${independentState.italic}`);

    await page.click('[data-onc-edit-command="bold"]');
    const independentOffState = await page.evaluate(() => {
      const boldButton = document.querySelector('[data-onc-edit-command="bold"]');
      const italicButton = document.querySelector('[data-onc-edit-command="italic"]');
      return {
        bold: boldButton ? boldButton.getAttribute('aria-pressed') : null,
        italic: italicButton ? italicButton.getAttribute('aria-pressed') : null
      };
    });
    assert(independentOffState.bold === 'false', `Expected bold to toggle off independently, got ${independentOffState.bold}`);
    assert(independentOffState.italic === 'true', `Expected italic to remain enabled when bold toggles off, got ${independentOffState.italic}`);

    await page.selectOption('[data-onc-role="style-select"]', 'heading-2');
    const heading2State = await page.evaluate(() => {
      const styleSelect = document.querySelector('[data-onc-role="style-select"]');
      const probe = window.__oncEditProbe || { execCalls: [] };
      const lastFormatBlock = Array.isArray(probe.execCalls)
        ? [...probe.execCalls].reverse().find((item) => item.command.toLowerCase() === 'formatblock')
        : null;
      return {
        value: styleSelect ? styleSelect.value : null,
        lastFormatBlock: lastFormatBlock ? String(lastFormatBlock.value || '').toLowerCase() : ''
      };
    });
    assert(heading2State.value === 'heading-2', `Expected styles dropdown to show heading-2, got ${heading2State.value}`);
    assert(heading2State.lastFormatBlock === 'h2', `Expected formatBlock command to use h2, got ${heading2State.lastFormatBlock}`);

    await page.selectOption('[data-onc-role="style-select"]', 'quote');
    const quoteState = await page.evaluate(() => {
      const styleSelect = document.querySelector('[data-onc-role="style-select"]');
      const probe = window.__oncEditProbe || { execCalls: [] };
      const lastFormatBlock = Array.isArray(probe.execCalls)
        ? [...probe.execCalls].reverse().find((item) => item.command.toLowerCase() === 'formatblock')
        : null;
      return {
        value: styleSelect ? styleSelect.value : null,
        lastFormatBlock: lastFormatBlock ? String(lastFormatBlock.value || '').toLowerCase() : ''
      };
    });
    assert(quoteState.value === 'quote', `Expected styles dropdown to show quote, got ${quoteState.value}`);
    assert(quoteState.lastFormatBlock === 'blockquote', `Expected formatBlock command to use blockquote, got ${quoteState.lastFormatBlock}`);

    await page.selectOption('[data-onc-role="style-select"]', 'code');
    const codeState = await page.evaluate(() => {
      const styleSelect = document.querySelector('[data-onc-role="style-select"]');
      const probe = window.__oncEditProbe || { execCalls: [] };
      const lastFormatBlock = Array.isArray(probe.execCalls)
        ? [...probe.execCalls].reverse().find((item) => item.command.toLowerCase() === 'formatblock')
        : null;
      return {
        value: styleSelect ? styleSelect.value : null,
        lastFormatBlock: lastFormatBlock ? String(lastFormatBlock.value || '').toLowerCase() : ''
      };
    });
    assert(codeState.value === 'code', `Expected styles dropdown to show code, got ${codeState.value}`);
    assert(codeState.lastFormatBlock === 'pre', `Expected formatBlock command to use pre, got ${codeState.lastFormatBlock}`);

    await page.selectOption('[data-onc-role="style-select"]', 'normal');
    const normalState = await page.evaluate(() => {
      const styleSelect = document.querySelector('[data-onc-role="style-select"]');
      const probe = window.__oncEditProbe || { execCalls: [] };
      const lastFormatBlock = Array.isArray(probe.execCalls)
        ? [...probe.execCalls].reverse().find((item) => item.command.toLowerCase() === 'formatblock')
        : null;
      return {
        value: styleSelect ? styleSelect.value : null,
        lastFormatBlock: lastFormatBlock ? String(lastFormatBlock.value || '').toLowerCase() : ''
      };
    });
    assert(normalState.value === 'normal', `Expected styles dropdown to return to Normal, got ${normalState.value}`);
    assert(normalState.lastFormatBlock === 'p', `Expected formatBlock command to return to paragraph, got ${normalState.lastFormatBlock}`);

    await page.click('[data-onc-edit-command="color"]');
    await page.evaluate(() => {
      const colorInput = document.querySelector('[data-onc-role="color-input"]');
      if (!colorInput) return;
      colorInput.value = '#ff0000';
      colorInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const colorProbe = await page.evaluate(() => {
      const probe = window.__oncEditProbe || { execCalls: [] };
      const foreColor = Array.isArray(probe.execCalls)
        ? [...probe.execCalls].reverse().find((item) => item.command.toLowerCase() === 'forecolor')
        : null;
      return {
        value: foreColor ? String(foreColor.value || '').toLowerCase() : ''
      };
    });
    assert(colorProbe.value === '#ff0000', `Expected color picker to apply foreColor #ff0000, got ${colorProbe.value}`);

    await page.click('[data-onc-edit-command="link"]');
    const linkProbe = await page.evaluate(() => {
      const probe = window.__oncEditProbe || { prompts: [], execCalls: [] };
      const anchorInsert = Array.isArray(probe.execCalls)
        ? probe.execCalls.find((item) => item.command.toLowerCase() === 'inserthtml')
        : null;
      return {
        prompts: probe.prompts || [],
        anchorInsert: anchorInsert || null
      };
    });
    assert(linkProbe.prompts.length >= 2, `Expected hyperlink flow to prompt at least twice, got ${linkProbe.prompts.length}`);
    assert(/url/i.test(linkProbe.prompts[0].message), `Expected first hyperlink prompt to request URL, got ${linkProbe.prompts[0].message}`);
    assert(/display text/i.test(linkProbe.prompts[1].message), `Expected second hyperlink prompt to request display text, got ${linkProbe.prompts[1].message}`);
    assert(Boolean(linkProbe.anchorInsert), 'Expected hyperlink flow to insert HTML anchor via execCommand(insertHTML)');
    assert(/<a\s+href="https:\/\/example\.com">Example Link<\/a>/i.test(String(linkProbe.anchorInsert && linkProbe.anchorInsert.value ? linkProbe.anchorInsert.value : '')), 'Expected inserted hyperlink markup to include prompted URL and display text');

    await page.evaluate(() => {
      if (window.__oncEditProbe && typeof window.__oncEditProbe.restore === 'function') {
        window.__oncEditProbe.restore();
      }
    });

    await page.click('[data-onc-action="metadata-toggle"]');
    const metadataState = await page.evaluate(() => {
      const panel = document.querySelector('[data-onc-role="metadata-panel"]');
      const pageTitle = panel ? panel.querySelector('[data-onc-field="page-title"]') : null;
      const exportFormat = panel ? panel.querySelector('[data-onc-field="export-format"]') : null;
      return {
        visible: Boolean(panel && !panel.hidden),
        text: panel ? String(panel.textContent || '') : '',
        pageTitle: pageTitle ? String(pageTitle.textContent || '').trim() : '',
        exportFormat: exportFormat ? String(exportFormat.textContent || '').trim() : ''
      };
    });
    assert(metadataState.visible === true, 'Expected metadata panel to open');
    assert(!/Profile/i.test(metadataState.text) && !/Warnings/i.test(metadataState.text), 'Did not expect Profile or Warnings entries in metadata panel');
    assert(metadataState.pageTitle === 'Toolbar', `Expected metadata panel to show page title Toolbar, got ${metadataState.pageTitle}`);
    assert(metadataState.exportFormat === 'html', `Expected metadata panel to show export format html, got ${metadataState.exportFormat}`);

    const helperText = await page.textContent('#onenote-cleaner-toolbar');
    assert(!/Advanced features in one toolbar/i.test(String(helperText || '')), 'Did not expect removed helper message to be present');

    await page.click('[data-onc-action="hide-toolbar"]');

    const hiddenState = await page.evaluate(() => {
      const root = document.getElementById('onenote-cleaner-toolbar');
      const showButton = document.getElementById('onc-toolbar-show');
      const toggle = document.getElementById('onc-converted-theme-toggle');
      const showRect = showButton ? showButton.getBoundingClientRect() : null;
      const toggleRect = toggle ? toggle.getBoundingClientRect() : null;
      return {
        toolbarHidden: Boolean(root && root.hidden),
        showVisible: Boolean(showButton && !showButton.hidden),
        showLabel: showButton ? (showButton.textContent || '').trim() : '',
        showTop: showRect ? Math.round(showRect.top) : -1,
        toggleTop: toggleRect ? Math.round(toggleRect.top) : -1,
        showRight: showRect ? Math.round(showRect.right) : -1,
        toggleRight: toggleRect ? Math.round(toggleRect.right) : -1
      };
    });

    assert(hiddenState.toolbarHidden === true, 'Expected toolbar to be hidden after clicking hide button');
    assert(hiddenState.showVisible === true, 'Expected show button to be visible after hiding toolbar');
    assert(hiddenState.showLabel === 'Toolbar', `Expected reveal button label to be Toolbar, got ${hiddenState.showLabel}`);
    assert(Math.abs(hiddenState.showTop - hiddenState.toggleTop) <= 6, `Expected reveal button to align next to theme toggle vertically, got show=${hiddenState.showTop} toggle=${hiddenState.toggleTop}`);
    assert(hiddenState.showRight < hiddenState.toggleRight, `Expected reveal button to sit left of theme toggle, got showRight=${hiddenState.showRight} toggleRight=${hiddenState.toggleRight}`);

    await page.click('#onc-toolbar-show');

    const shownState = await page.evaluate(() => {
      const root = document.getElementById('onenote-cleaner-toolbar');
      const showButton = document.getElementById('onc-toolbar-show');
      return {
        toolbarHidden: Boolean(root && root.hidden),
        showVisible: Boolean(showButton && !showButton.hidden)
      };
    });

    assert(shownState.toolbarHidden === false, 'Expected toolbar to reappear after clicking show button');
    assert(shownState.showVisible === false, 'Expected show button to hide after restoring toolbar');

    console.log('toolbar-hide-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('toolbar-hide-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
