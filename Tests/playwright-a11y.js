import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';
import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

// `require` helper for ESM modules (used to resolve axe-core script path)
const require = createRequire(import.meta.url);

// This script performs an accessibility audit using axe-core against
// each dark theme variant. It writes individual JSON reports and
// exits with a non-zero code if any serious/critical violations are found.


async function loadTheme(page, url, theme, axePath) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((nextTheme) => {
    localStorage.setItem('theme', nextTheme);
    localStorage.removeItem('themeVariant');
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction((expectedDark) => {
    const btn = document.getElementById('themeToggle');
    return document.documentElement.classList.contains('dark') === expectedDark
      && (!btn || btn.getAttribute('aria-pressed') === String(expectedDark));
  }, theme === 'dark');
  await page.addScriptTag({ path: axePath });
}

async function assertHelpModalKeyboardFlow(page, theme) {
  await page.evaluate(() => {
    const button = document.getElementById('helpButton');
    if (button) button.focus();
  });
  await page.keyboard.press('Enter');

  await page.waitForFunction(() => {
    const modal = document.getElementById('helpModal');
    return modal && !modal.classList.contains('hidden');
  });

  const firstSectionOpen = await page.locator('#helpModal details').first().evaluate((el) => el.open);
  if (!firstSectionOpen) {
    throw new Error(`Expected first Help section to be open by default in ${theme} theme`);
  }

  const secondSection = page.locator('#helpModal details').nth(1);
  await secondSection.locator('summary').focus();
  await page.keyboard.press('Enter');

  const secondSectionOpen = await secondSection.evaluate((el) => el.open);
  if (!secondSectionOpen) {
    throw new Error(`Expected second Help section to open from keyboard in ${theme} theme`);
  }

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const modal = document.getElementById('helpModal');
    return modal && modal.classList.contains('hidden');
  });
}

(async () => {
  const root = process.cwd();
  const serverHandle = await startStaticServer(root);
  const url = `${serverHandle.baseUrl}/`;

  // only audit the two canonical themes: light and default dark (Charcoal)
  const themes = [
    'light',
    'dark'
  ];

  // prepare report directory
  const reportDir = path.join(root, 'Tests', 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  let browser;
  let hadSerious = false;

  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err && err.stack ? err.stack : err));

    const axePath = require.resolve('axe-core/axe.min.js');

    for (const theme of themes) {
      console.log('Auditing theme:', theme);
      await loadTheme(page, url, theme, axePath);
      await assertHelpModalKeyboardFlow(page, theme);

      // disable any color transitions to ensure axe sees the final style
      await page.evaluate(() => {
        document.querySelectorAll('.transition-colors').forEach(el => {
          el.style.transition = 'none';
        });
      });

      // log computed styles for dropzone and its ancestors (debug)
      const debugStyles = await page.evaluate(() => {
        const el = document.getElementById('dropzone');
        const cs = getComputedStyle(el);
        let cur = el;
        const ancestors = [];
        while (cur) {
          const c = getComputedStyle(cur);
          ancestors.push({ tag: cur.tagName, bg: c.backgroundColor, color: c.color });
          cur = cur.parentElement;
        }
        return { drop: { bg: cs.backgroundColor, color: cs.color }, ancestors };
      });
      console.log('computed styles:', debugStyles);

      // run axe
      const results = await page.evaluate(async () => await axe.run());
      const outPath = path.join(reportDir, `a11y-${theme}.json`);
      fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

      const serious = results.violations.filter(x => x.impact === 'serious' || x.impact === 'critical');
      if (serious.length) {
        hadSerious = true;
        console.log(`  -> found ${serious.length} serious/critical violations`);
      } else {
        console.log('  -> no serious/critical violations');
      }
    }

    // summary file
    const summary = themes.map(t => {
      const rpt = require(path.join(reportDir, `a11y-${t}.json`));
      const total = rpt.violations.length;
      const sev = rpt.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').length;
      return `${t}: total=${total} serious_or_critical=${sev}`;
    }).join('\n');
    fs.writeFileSync(path.join(reportDir, 'a11y-summary.txt'), summary);

    await browser.close();
    await serverHandle.close();

    if (hadSerious) {
      console.error('Accessibility audit: SERIOUS/CRITICAL violations detected. See Tests/reports.');
      process.exit(1);
    }

    console.log('Accessibility audit: OK');
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('Accessibility audit: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
