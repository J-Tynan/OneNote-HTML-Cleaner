import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './playwright-server-helper.js';

function resolveFixtureSource(testsDir, cleanedHtmlName) {
  const stem = String(cleanedHtmlName || '').replace(/\.html$/i, '');
  const candidates = [`${stem}.mht`, `${stem}.mhtml`];
  for (const name of candidates) {
    const filePath = path.join(testsDir, name);
    if (fs.existsSync(filePath)) return { name, filePath };
  }
  return null;
}

(async () => {
  const root = process.cwd();
  const testsDir = path.join(root, 'Tests');
  const manifestPath = path.join(testsDir, 'expected', 'locked-cleaned', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const requiredFiles = Array.isArray(manifest.requiredFiles) ? manifest.requiredFiles : [];

  if (!requiredFiles.length) {
    console.log('externalize-css-visual-parity-playwright: no locked fixtures found; skipping');
    process.exit(0);
  }

  const fixtures = requiredFiles.map((cleanedHtmlName) => {
    const source = resolveFixtureSource(testsDir, cleanedHtmlName);
    if (!source) {
      throw new Error(`Unable to resolve source fixture for ${cleanedHtmlName}`);
    }
    return {
      cleanedHtmlName,
      sourceName: source.name,
      rawInput: fs.readFileSync(source.filePath, 'latin1')
    };
  });

  const serverHandle = await startStaticServer(root);
  const url = `${serverHandle.baseUrl}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    const mismatches = [];

    for (const fixture of fixtures) {
      const result = await page.evaluate(async (args) => {
        const parseModule = await import('/src/pipeline/mht.js');
        const pipelineModule = await import('/src/pipeline/pipeline.js');

        const parsed = parseModule.parseMht(args.rawInput || '', { EnableCharsetFallback: true, EnableMapping: true });
        const imageMap = parsed && parsed.imageMap ? parsed.imageMap : {};
        const sourceHtml = parsed && parsed.html ? parsed.html : '';

        const baseConfig = {
          EnableCharsetFallback: true,
          OutputCleanupMode: 'safe',
          UnitStrategy: 'normalize-safe',
          InjectTailwindCss: false,
          imageMap
        };

        const embedded = await pipelineModule.runPipeline(sourceHtml, {
          ...baseConfig,
          ExternalizeCssEnabled: false
        });

        const externalized = await pipelineModule.runPipeline(sourceHtml, {
          ...baseConfig,
          ExternalizeCssEnabled: true,
          ExternalizeCssMode: 'shared'
        });

        const cssAsset = (externalized.assets || []).find((asset) => asset && asset.type === 'text/css' && typeof asset.content === 'string');
        if (!cssAsset || !cssAsset.content) {
          return {
            fixture: args.fixture,
            ok: false,
            reason: 'missing externalized css asset',
            mismatches: []
          };
        }

        const withInlineCss = String(externalized.output || '').includes('</head>')
          ? String(externalized.output || '').replace('</head>', `<style data-test-extcss>${cssAsset.content}</style></head>`)
          : `<style data-test-extcss>${cssAsset.content}</style>${String(externalized.output || '')}`;

        const selectors = [
          'h1',
          '.converted-page-date',
          'p',
          'table',
          'ul,ol',
          '.converted-page-title'
        ];

        const properties = [
          'font-size',
          'font-family',
          'font-weight',
          'line-height',
          'color',
          'margin-top',
          'margin-right',
          'margin-bottom',
          'margin-left',
          'padding-bottom',
          'border-bottom-width',
          'border-collapse'
        ];

        function renderAndSnapshot(html) {
          return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.left = '-20000px';
            iframe.style.top = '-20000px';
            iframe.style.width = '1366px';
            iframe.style.height = '2200px';
            document.body.appendChild(iframe);
            iframe.onload = () => {
              const doc = iframe.contentDocument;
              const out = {};

              selectors.forEach((selector) => {
                const el = doc.querySelector(selector);
                if (!el) return;
                const style = iframe.contentWindow.getComputedStyle(el);
                const values = {};
                properties.forEach((prop) => {
                  values[prop] = style.getPropertyValue(prop);
                });
                out[selector] = values;
              });

              out.__height = Math.max(
                doc.documentElement ? doc.documentElement.scrollHeight : 0,
                doc.body ? doc.body.scrollHeight : 0
              );

              iframe.remove();
              resolve(out);
            };
            iframe.srcdoc = html;
          });
        }

        const embeddedSnapshot = await renderAndSnapshot(String(embedded.output || ''));
        const externalSnapshot = await renderAndSnapshot(withInlineCss);

        const snapshotMismatches = [];
        selectors.forEach((selector) => {
          const left = embeddedSnapshot[selector];
          const right = externalSnapshot[selector];
          if (!left && !right) return;
          if (!left || !right) {
            snapshotMismatches.push({ selector, property: '__presence', embedded: Boolean(left), externalized: Boolean(right) });
            return;
          }

          properties.forEach((prop) => {
            const lv = String(left[prop] || '').trim();
            const rv = String(right[prop] || '').trim();
            if (lv !== rv) {
              snapshotMismatches.push({ selector, property: prop, embedded: lv, externalized: rv });
            }
          });
        });

        const heightDelta = Math.abs((embeddedSnapshot.__height || 0) - (externalSnapshot.__height || 0));
        if (heightDelta > 4) {
          snapshotMismatches.push({
            selector: '__document',
            property: 'scroll-height',
            embedded: embeddedSnapshot.__height,
            externalized: externalSnapshot.__height
          });
        }

        return {
          fixture: args.fixture,
          ok: snapshotMismatches.length === 0,
          mismatches: snapshotMismatches
        };
      }, { fixture: fixture.cleanedHtmlName, rawInput: fixture.rawInput });

      if (!result.ok) {
        mismatches.push({ fixture: fixture.cleanedHtmlName, details: result.mismatches, reason: result.reason || '' });
      }
    }

    if (mismatches.length) {
      console.error('externalize-css-visual-parity-playwright: FAIL');
      mismatches.forEach((entry) => {
        console.error(`fixture: ${entry.fixture}`);
        if (entry.reason) console.error(`  reason: ${entry.reason}`);
        (entry.details || []).slice(0, 20).forEach((detail) => {
          console.error(`  ${detail.selector} :: ${detail.property} | embedded=${detail.embedded} externalized=${detail.externalized}`);
        });
      });
      process.exit(1);
    }

    console.log('externalize-css-visual-parity-playwright: OK');
    await browser.close();
    await serverHandle.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    await serverHandle.close();
    console.error('externalize-css-visual-parity-playwright: FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
