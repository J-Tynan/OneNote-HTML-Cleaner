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

  const base = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Converted Page</title></head><body><main><h1>Converted</h1><h2 id="summary-heading" style="color:#1E4E79">Summary</h2><ul><li id="study-question" style="color:#000000">Study Questions</li></ul><p>Body</p></main></body></html>';
  const withToolbarBase = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Converted Page</title></head><body><div id="onenote-cleaner-toolbar">Toolbar</div><main><h1>Converted</h1><p>Body</p></main></body></html>';

  const standardHtml = injector.injectConvertedPageThemeToggle(base, {
    ConvertedPageThemeToggleEnabled: true,
    ConvertedPageThemeToggleOledBlack: false,
    ExperimentalExportEnabled: false,
    ExportFormat: 'html'
  });

  const oledHtml = injector.injectConvertedPageThemeToggle(base, {
    ConvertedPageThemeToggleEnabled: true,
    ConvertedPageThemeToggleOledBlack: true,
    ExperimentalExportEnabled: false,
    ExportFormat: 'html'
  });

  const toolbarHtml = injector.injectConvertedPageThemeToggle(withToolbarBase, {
    ConvertedPageThemeToggleEnabled: true,
    ConvertedPageThemeToggleOledBlack: false,
    ExperimentalExportEnabled: false,
    ExportFormat: 'html'
  });

  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (url === '/standard') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(standardHtml);
      return;
    }
    if (url === '/oled') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(oledHtml);
      return;
    }
    if (url === '/toolbar') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(toolbarHtml);
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
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${baseUrl}/standard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#onc-converted-theme-toggle');

    await page.evaluate(() => {
      try { localStorage.setItem('onc:converted-theme:' + location.pathname, 'light'); } catch (_err) {}
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#onc-converted-theme-toggle');

    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-onc-converted-theme'));
    assert(initialTheme === 'light', 'Expected default converted-page theme to be light');
    const initialIcon = await page.textContent('#onc-converted-theme-toggle');
    assert((initialIcon || '').trim() === '🔆', `Expected light-theme toggle icon to be 🔆, got ${(initialIcon || '').trim()}`);

    await page.click('#onc-converted-theme-toggle');
    const darkTheme = await page.evaluate(() => document.documentElement.getAttribute('data-onc-converted-theme'));
    assert(darkTheme === 'dark', 'Expected converted-page theme to switch to dark on click');
    const darkIcon = await page.textContent('#onc-converted-theme-toggle');
    assert((darkIcon || '').trim() === '🌙', `Expected dark-theme toggle icon to be 🌙, got ${(darkIcon || '').trim()}`);

    const standardDarkState = await page.evaluate(() => {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const heading = document.getElementById('summary-heading');
      const question = document.getElementById('study-question');
      return {
        bodyBg,
        headingColor: heading ? getComputedStyle(heading).color : '',
        questionColor: question ? getComputedStyle(question).color : ''
      };
    });

    assert(standardDarkState.bodyBg === 'rgb(31, 31, 31)', `Expected standard dark body background to be dark grey, got ${standardDarkState.bodyBg}`);
    assert(standardDarkState.headingColor === 'rgb(230, 230, 230)', `Expected Summary heading to recolor in dark theme, got ${standardDarkState.headingColor}`);
    assert(standardDarkState.questionColor === 'rgb(230, 230, 230)', `Expected Study Questions text to recolor in dark theme, got ${standardDarkState.questionColor}`);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#onc-converted-theme-toggle');
    const persistedTheme = await page.evaluate(() => document.documentElement.getAttribute('data-onc-converted-theme'));
    assert(persistedTheme === 'dark', 'Expected converted-page theme to persist per file via localStorage');

    await page.goto(`${baseUrl}/oled`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#onc-converted-theme-toggle');
    await page.click('#onc-converted-theme-toggle');

    const oledState = await page.evaluate(() => {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const bodyColor = getComputedStyle(document.body).color;
      const main = document.querySelector('main');
      const mainBg = main ? getComputedStyle(main).backgroundColor : '';
      const oled = document.documentElement.getAttribute('data-onc-converted-oled');
      return { bodyBg, bodyColor, mainBg, oled };
    });

    assert(oledState.oled === 'true', 'Expected OLED flag on document element when OLED option is enabled');
    assert(oledState.bodyBg === 'rgb(0, 0, 0)', `Expected OLED body background to be black, got ${oledState.bodyBg}`);
    assert(oledState.bodyColor === 'rgb(214, 214, 207)', `Expected OLED body text color to be off-white, got ${oledState.bodyColor}`);
    assert(oledState.mainBg === 'rgb(0, 0, 0)', `Expected OLED main background to be black, got ${oledState.mainBg}`);

    await page.goto(`${baseUrl}/toolbar`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#onc-converted-theme-toggle');

    const topOffset = await page.evaluate(() => {
      const toggle = document.getElementById('onc-converted-theme-toggle');
      const top = toggle ? getComputedStyle(toggle).top : '0px';
      return Number.parseFloat(top || '0');
    });

    assert(topOffset >= 60, `Expected converted-page theme toggle to be offset below toolbar, got top ${topOffset}px`);

    console.log('converted-page-theme-toggle-playwright: OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    server.close();
    console.error('converted-page-theme-toggle-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
