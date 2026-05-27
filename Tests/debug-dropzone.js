import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

(async () => {
  const serverHandle = await startStaticServer(process.cwd());
  const url = `${serverHandle.baseUrl}/`;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  for (const theme of ['light', 'dark']) {
    console.log('theme', theme);
    await page.evaluate((t) => {
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.removeItem('theme');
      }
      document.documentElement.removeAttribute('data-variant');
      localStorage.removeItem('themeVariant');
    }, theme);
    await page.waitForTimeout(200);
    const styles = await page.evaluate(() => {
      const el = document.getElementById('dropzone');
      const cs = getComputedStyle(el);
      const body = document.body;
      const csb = getComputedStyle(body);
      const htmlEl = document.documentElement;
      const csh = getComputedStyle(htmlEl);
      return { drop: { bg: cs.backgroundColor, color: cs.color }, body: { bg: csb.backgroundColor, color: csb.color }, html: { bg: csh.backgroundColor, color: csh.color } };
    });
    console.log(styles);
  }

  await browser.close();
  await serverHandle.close();
})();
