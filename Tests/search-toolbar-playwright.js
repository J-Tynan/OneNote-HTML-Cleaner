import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${serverHandle.baseUrl}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.results-workbench-toolbar');

    const desktopLayout = await page.evaluate(() => {
      const toolbar = document.querySelector('.results-workbench-toolbar');
      const searchGroup = document.querySelector('.workbench-search-group');
      const icon = document.querySelector('.results-search-icon');
      const search = document.getElementById('workbenchSearch');
      const filter = document.getElementById('workbenchFilter');
      const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
      const groupRect = searchGroup?.getBoundingClientRect();
      const iconRect = icon?.getBoundingClientRect();
      const searchRect = search?.getBoundingClientRect();
      const filterRect = filter?.getBoundingClientRect();
      return {
        gridColumns: toolbarStyle?.gridTemplateColumns ?? '',
        groupLeft: groupRect?.left ?? 0,
        iconCenter: iconRect ? iconRect.top + (iconRect.height / 2) : 0,
        searchCenter: searchRect ? searchRect.top + (searchRect.height / 2) : 0,
        searchWidth: searchRect?.width ?? 0,
        filterLeft: filterRect?.left ?? 0,
        filterWidth: filterRect?.width ?? 0
      };
    });

    if (!desktopLayout.gridColumns.includes('136px')) {
      throw new Error(`Expected a fixed 8.5rem filter track, got ${JSON.stringify(desktopLayout)}`);
    }
    if (Math.abs(desktopLayout.iconCenter - desktopLayout.searchCenter) > 2) {
      throw new Error(`Expected the search icon and input on one row, got ${JSON.stringify(desktopLayout)}`);
    }
    if (desktopLayout.searchWidth <= desktopLayout.filterWidth || desktopLayout.groupLeft >= desktopLayout.filterLeft) {
      throw new Error(`Expected a wide search control before the filter, got ${JSON.stringify(desktopLayout)}`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileLayout = await page.evaluate(() => {
      const toolbar = document.querySelector('.results-workbench-toolbar');
      const searchGroup = document.querySelector('.workbench-search-group');
      const search = document.getElementById('workbenchSearch');
      const filter = document.getElementById('workbenchFilter');
      const toolbarRect = toolbar?.getBoundingClientRect();
      const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
      const groupRect = searchGroup?.getBoundingClientRect();
      const searchRect = search?.getBoundingClientRect();
      const filterRect = filter?.getBoundingClientRect();
      const contentWidth = toolbarRect && toolbarStyle
        ? toolbarRect.width - parseFloat(toolbarStyle.paddingLeft) - parseFloat(toolbarStyle.paddingRight)
        : 0;
      return {
        contentWidth,
        groupTop: groupRect?.top ?? 0,
        groupWidth: groupRect?.width ?? 0,
        searchWidth: searchRect?.width ?? 0,
        filterTop: filterRect?.top ?? 0,
        filterWidth: filterRect?.width ?? 0
      };
    });

    if (mobileLayout.groupTop >= mobileLayout.filterTop) {
      throw new Error(`Expected the search group above the filter on mobile, got ${JSON.stringify(mobileLayout)}`);
    }
    if (mobileLayout.searchWidth <= 0 || mobileLayout.groupWidth < mobileLayout.contentWidth - 2 || mobileLayout.filterWidth < mobileLayout.contentWidth - 2) {
      throw new Error(`Expected both mobile controls to fit the padded toolbar, got ${JSON.stringify(mobileLayout)}`);
    }

    console.log('search-toolbar-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (error) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('search-toolbar-playwright: FAIL', error?.stack ?? error);
    process.exit(1);
  }
})();