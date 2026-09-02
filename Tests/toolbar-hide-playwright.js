import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { startRouteServer } from './playwright-server-helper.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const PRESETS = ['compact', 'office', 'ribbon'];
const VIEWPORTS = [
  { name: 'narrow-phone', width: 320, height: 740 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 960 }
];
const STYLE_VALUES = ['page-title', 'heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6', 'citation', 'quote', 'code', 'normal'];

function isDarkRgb(color) {
  const match = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return false;
  const parts = match.slice(1, 4).map((value) => Number.parseInt(value, 10));
  return parts.every((value) => Number.isFinite(value)) && ((parts[0] + parts[1] + parts[2]) / 3) < 120;
}

(async () => {
  const injectorPath = path.resolve(process.cwd(), 'src', 'pipeline', 'toolbarInjector.js');
  const injector = await import(pathToFileURL(injectorPath).href);

  const base = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Toolbar</title></head><body><main><h1 data-onc-editable="1">Converted</h1><p data-onc-editable="1">Body</p></main></body></html>';

  function buildToolbarPage(toolbarStyle) {
    const withToolbar = injector.injectOutputToolbar(base, {
      ToolbarEnabled: true,
      ToolbarEditToggleEnabled: true,
      ToolbarMetadataToggleEnabled: true,
      ToolbarBundleMode: 'inline',
      ToolbarStyle: toolbarStyle,
      SourceName: 'Sample.mht',
      SourceKind: 'mht',
      Profile: 'onenote',
      WarningSummary: { total: 0, info: 0, warning: 0, error: 0 }
    });

    return injector.injectConvertedPageThemeToggle(withToolbar, {
      ConvertedPageThemeToggleEnabled: true,
      ExperimentalExportEnabled: false,
      ExportFormat: 'html'
    });
  }

  const presetPages = Object.fromEntries(PRESETS.map((preset) => [preset, buildToolbarPage(preset)]));
  const routes = {
    '/toolbar': presetPages.office
  };
  for (const [preset, pageHtml] of Object.entries(presetPages)) {
    routes[`/toolbar/${preset}`] = pageHtml;
  }
  const serverHandle = await startRouteServer(routes);

  async function waitForToolbarReady(page) {
    await page.waitForSelector('#onenote-cleaner-toolbar', { state: 'attached' });
    await page.waitForSelector('#onc-converted-theme-toggle');
    await page.waitForFunction(() => {
      const root = document.getElementById('onenote-cleaner-toolbar');
      return Boolean(root && root.dataset && root.dataset.oncInitialized === '1');
    });
  }

  async function getInitialState(page) {
    return page.evaluate(() => {
      const root = document.getElementById('onenote-cleaner-toolbar');
      const showButton = document.getElementById('onc-toolbar-show');
      return {
        preset: root ? root.getAttribute('data-onc-toolbar-preset') : '',
        toolbarHidden: Boolean(root && root.hidden),
        showVisible: Boolean(showButton && !showButton.hidden)
      };
    });
  }

  async function getVisibleMetrics(page) {
    return page.evaluate(() => {
      const root = document.getElementById('onenote-cleaner-toolbar');
      const firstButton = document.querySelector('#onenote-cleaner-toolbar .onc-btn');
      const styleSelect = document.querySelector('[data-onc-role="style-select"]');
      const editTools = document.querySelector('[data-onc-role="edit-tools"]');
      const metadataToggle = document.querySelector('[data-onc-action="metadata-toggle"]');
      const themeToggle = document.getElementById('onc-converted-theme-toggle');
      const rootStyle = root ? getComputedStyle(root) : null;
      const buttonStyle = firstButton ? getComputedStyle(firstButton) : null;
      const rootRect = root ? root.getBoundingClientRect() : null;
      const styleRect = styleSelect ? styleSelect.getBoundingClientRect() : null;
      return {
        preset: root ? root.getAttribute('data-onc-toolbar-preset') : '',
        toolbarHidden: Boolean(root && root.hidden),
        editToolsVisible: Boolean(editTools && !editTools.hidden),
        metadataToggleVisible: Boolean(metadataToggle && !metadataToggle.hidden),
        themeToggleVisible: Boolean(themeToggle && !themeToggle.hidden),
        styleDisabled: styleSelect ? styleSelect.disabled : true,
        styleWidth: styleRect ? styleRect.width : 0,
        styleValues: styleSelect ? Array.from(styleSelect.options).map((option) => option.value) : [],
        toolbarPaddingTop: rootStyle ? parseFloat(rootStyle.paddingTop || '0') : 0,
        toolbarPaddingLeft: rootStyle ? parseFloat(rootStyle.paddingLeft || '0') : 0,
        toolbarBackgroundColor: rootStyle ? rootStyle.backgroundColor : '',
        toolbarBackgroundImage: rootStyle ? rootStyle.backgroundImage : '',
        toolbarColor: rootStyle ? rootStyle.color : '',
        toolbarLeft: rootRect ? rootRect.left : 0,
        toolbarRight: rootRect ? rootRect.right : 0,
        buttonFontSize: buttonStyle ? parseFloat(buttonStyle.fontSize || '0') : 0,
        buttonPaddingLeft: buttonStyle ? parseFloat(buttonStyle.paddingLeft || '0') : 0,
        buttonPaddingRight: buttonStyle ? parseFloat(buttonStyle.paddingRight || '0') : 0,
        buttonRadius: buttonStyle ? parseFloat(buttonStyle.borderRadius || '0') : 0
      };
    });
  }

  async function getMetadataState(page) {
    return page.evaluate(() => {
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
  }

  async function getHiddenState(page) {
    return page.evaluate(() => {
      const root = document.getElementById('onenote-cleaner-toolbar');
      const showButton = document.getElementById('onc-toolbar-show');
      const themeToggle = document.getElementById('onc-converted-theme-toggle');
      const showRect = showButton ? showButton.getBoundingClientRect() : null;
      const toggleRect = themeToggle ? themeToggle.getBoundingClientRect() : null;
      const scrollY = window.scrollY || 0;
      return {
        toolbarHidden: Boolean(root && root.hidden),
        showVisible: Boolean(showButton && !showButton.hidden),
        showLabel: showButton ? String(showButton.textContent || '').trim() : '',
        showTop: showRect ? Math.round(showRect.top + scrollY) : -1,
        toggleTop: toggleRect ? Math.round(toggleRect.top + scrollY) : -1,
        showRight: showRect ? Math.round(showRect.right) : -1,
        toggleRight: toggleRect ? Math.round(toggleRect.right) : -1
      };
    });
  }

  async function verifyPresetAcrossViewport(page, baseUrl, preset, viewport) {
    await page.goto(`${baseUrl}/toolbar/${preset}`, { waitUntil: 'networkidle' });
    await waitForToolbarReady(page);

    const initialState = await getInitialState(page);
    assert(initialState.preset === preset, `Expected ${preset} preset marker before interactions at ${viewport.name}, got ${initialState.preset}`);
    assert(initialState.toolbarHidden === true, `Expected toolbar to start hidden for ${preset} at ${viewport.name}`);
    assert(initialState.showVisible === true, `Expected reveal button visible for ${preset} at ${viewport.name}`);

    await page.click('#onc-toolbar-show');

    const metrics = await getVisibleMetrics(page);
    assert(metrics.preset === preset, `Expected ${preset} preset marker after showing toolbar at ${viewport.name}, got ${metrics.preset}`);
    assert(metrics.toolbarHidden === false, `Expected visible toolbar for ${preset} at ${viewport.name}`);
    assert(metrics.editToolsVisible === true, `Expected edit tools visible for ${preset} at ${viewport.name}`);
    assert(metrics.metadataToggleVisible === true, `Expected metadata toggle visible for ${preset} at ${viewport.name}`);
    assert(metrics.themeToggleVisible === true, `Expected converted theme toggle visible for ${preset} at ${viewport.name}`);
    assert(metrics.styleDisabled === false, `Expected styles dropdown enabled for ${preset} at ${viewport.name}`);
    assert(metrics.styleWidth > 80, `Expected non-trivial styles dropdown width for ${preset} at ${viewport.name}, got ${metrics.styleWidth}`);
    assert(JSON.stringify(metrics.styleValues) === JSON.stringify(STYLE_VALUES), `Expected styles dropdown values for ${preset} at ${viewport.name}, got ${JSON.stringify(metrics.styleValues)}`);
    assert(metrics.toolbarPaddingTop > 0, `Expected positive top padding for ${preset} at ${viewport.name}`);
    assert(metrics.toolbarPaddingLeft > 0, `Expected positive side padding for ${preset} at ${viewport.name}`);
    assert(metrics.buttonFontSize > 0, `Expected positive toolbar button font size for ${preset} at ${viewport.name}`);
    assert(metrics.buttonPaddingLeft > 0 && metrics.buttonPaddingRight > 0, `Expected positive toolbar button padding for ${preset} at ${viewport.name}`);
    assert(metrics.toolbarLeft >= -1, `Expected toolbar to remain onscreen on the left for ${preset} at ${viewport.name}, got ${metrics.toolbarLeft}`);
    assert(metrics.toolbarRight <= viewport.width + 2, `Expected toolbar to remain within viewport width for ${preset} at ${viewport.name}, got right=${metrics.toolbarRight} viewport=${viewport.width}`);

    await page.click('[data-onc-action="metadata-toggle"]');
    const metadataOpen = await getMetadataState(page);
    assert(metadataOpen.visible === true, `Expected metadata panel to open for ${preset} at ${viewport.name}`);
    assert(!/Profile/i.test(metadataOpen.text) && !/Warnings/i.test(metadataOpen.text), `Did not expect Profile or Warnings entries in metadata panel for ${preset} at ${viewport.name}`);
    assert(metadataOpen.pageTitle === 'Toolbar', `Expected metadata page title for ${preset} at ${viewport.name}, got ${metadataOpen.pageTitle}`);
    assert(metadataOpen.exportFormat === 'html', `Expected metadata export format html for ${preset} at ${viewport.name}, got ${metadataOpen.exportFormat}`);

    await page.click('[data-onc-action="metadata-toggle"]');
    const metadataClosed = await getMetadataState(page);
    assert(metadataClosed.visible === false, `Expected metadata panel to close for ${preset} at ${viewport.name}`);

    const helperText = await page.textContent('#onenote-cleaner-toolbar');
    assert(!/Advanced features in one toolbar/i.test(String(helperText || '')), `Did not expect removed helper message to be present for ${preset} at ${viewport.name}`);

    await page.click('[data-onc-action="hide-toolbar"]');
    const hiddenState = await getHiddenState(page);
    assert(hiddenState.toolbarHidden === true, `Expected toolbar hidden after hide action for ${preset} at ${viewport.name}`);
    assert(hiddenState.showVisible === true, `Expected reveal button visible after hiding toolbar for ${preset} at ${viewport.name}`);
    assert(hiddenState.showLabel === 'Toolbar', `Expected reveal button label Toolbar for ${preset} at ${viewport.name}, got ${hiddenState.showLabel}`);
    assert(Math.abs(hiddenState.showTop - hiddenState.toggleTop) <= 6, `Expected reveal button vertical alignment near theme toggle for ${preset} at ${viewport.name}, got show=${hiddenState.showTop} toggle=${hiddenState.toggleTop}`);
    assert(hiddenState.showRight < hiddenState.toggleRight, `Expected reveal button left of theme toggle for ${preset} at ${viewport.name}, got showRight=${hiddenState.showRight} toggleRight=${hiddenState.toggleRight}`);

    await page.click('#onc-toolbar-show');
    const restoredState = await getInitialState(page);
    assert(restoredState.toolbarHidden === false, `Expected toolbar restored after show action for ${preset} at ${viewport.name}`);
    assert(restoredState.showVisible === false, `Expected reveal button hidden while toolbar visible for ${preset} at ${viewport.name}`);

    return metrics;
  }

  const baseUrl = serverHandle.baseUrl;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const metricsByViewport = new Map();

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const viewportMetrics = {};
      for (const preset of PRESETS) {
        viewportMetrics[preset] = await verifyPresetAcrossViewport(page, baseUrl, preset, viewport);
      }
      metricsByViewport.set(viewport.name, viewportMetrics);
    }

    for (const viewport of VIEWPORTS) {
      const viewportMetrics = metricsByViewport.get(viewport.name);
      const compact = viewportMetrics.compact;
      const office = viewportMetrics.office;
      const ribbon = viewportMetrics.ribbon;

      assert(compact.toolbarPaddingTop < office.toolbarPaddingTop, `Expected compact top padding smaller than office at ${viewport.name}, got compact=${compact.toolbarPaddingTop} office=${office.toolbarPaddingTop}`);
      assert(compact.toolbarPaddingLeft < office.toolbarPaddingLeft, `Expected compact side padding smaller than office at ${viewport.name}, got compact=${compact.toolbarPaddingLeft} office=${office.toolbarPaddingLeft}`);
      assert(compact.buttonPaddingLeft < office.buttonPaddingLeft, `Expected compact button padding-left smaller than office at ${viewport.name}, got compact=${compact.buttonPaddingLeft} office=${office.buttonPaddingLeft}`);
      assert(compact.buttonPaddingRight < office.buttonPaddingRight, `Expected compact button padding-right smaller than office at ${viewport.name}, got compact=${compact.buttonPaddingRight} office=${office.buttonPaddingRight}`);
      if (viewport.width > 640) {
        assert(ribbon.styleWidth > compact.styleWidth, `Expected ribbon style dropdown wider than compact at ${viewport.name}, got ribbon=${ribbon.styleWidth} compact=${compact.styleWidth}`);
      }
      assert(/gradient|linear-gradient/i.test(String(ribbon.toolbarBackgroundImage || '')), `Expected ribbon preset to keep gradient background at ${viewport.name}, got ${ribbon.toolbarBackgroundImage}`);
      assert(!isDarkRgb(compact.toolbarBackgroundColor), `Did not expect compact preset toolbar background to be dark at ${viewport.name}, got ${compact.toolbarBackgroundColor}`);
    }

    console.log('toolbar-hide-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('toolbar-hide-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
