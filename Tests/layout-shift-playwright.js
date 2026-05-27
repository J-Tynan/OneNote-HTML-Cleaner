import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  const widthBefore = await page.evaluate(() => document.body.clientWidth);
  console.log('width before details:', widthBefore);

  await page.click('#advancedOptions > summary');
  await page.waitForSelector('#advancedOptions[open]');

  const widthAfter = await page.evaluate(() => document.body.clientWidth);
  console.log('width after details:', widthAfter);

  const beforeToggle = await page.evaluate(() => {
    const importButton = document.getElementById('importButton');
    const notice = document.getElementById('autoConvertNotice');
    return {
      buttonTop: importButton ? importButton.getBoundingClientRect().top + window.scrollY : 0,
      scrollY: window.scrollY,
      noticeHeight: notice ? notice.getBoundingClientRect().height : 0,
      noticeText: notice ? notice.textContent.replace(/\s+/g, ' ').trim() : ''
    };
  });
  console.log('before auto-convert toggle:', beforeToggle);

  await page.click('#autoConvertEnabled');
  await page.waitForFunction(() => {
    const notice = document.getElementById('autoConvertNotice');
    return notice && notice.textContent.includes('convert them manually');
  });

  const afterToggle = await page.evaluate(() => {
    const importButton = document.getElementById('importButton');
    const notice = document.getElementById('autoConvertNotice');
    return {
      buttonTop: importButton ? importButton.getBoundingClientRect().top + window.scrollY : 0,
      scrollY: window.scrollY,
      noticeHeight: notice ? notice.getBoundingClientRect().height : 0,
      noticeText: notice ? notice.textContent.replace(/\s+/g, ' ').trim() : ''
    };
  });
  console.log('after auto-convert toggle:', afterToggle);

  await browser.close();
  await serverHandle.close();

  const widthStable = widthBefore === widthAfter;
  const buttonTopStable = Math.abs(beforeToggle.buttonTop - afterToggle.buttonTop) <= 1;
  const noticeStillVisible = afterToggle.noticeHeight > 0;

  process.exit(widthStable && buttonTopStable && noticeStillVisible ? 0 : 1);
})();
