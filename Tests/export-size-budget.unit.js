import assert from 'node:assert';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('');
global.DOMParser = dom.window.DOMParser;
global.NodeFilter = dom.window.NodeFilter;

const { parseMht } = await import('../src/pipeline/mht.js');
const { runPipeline } = await import('../src/pipeline/pipeline.js');

console.log('running export size budget unit tests');

{
  const realLog = console.log;
  const realInfo = console.info;
  const realWarn = console.warn;
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  const raw = fs.readFileSync('./Tests/DevToys.mht', 'latin1');
  const parsed = parseMht(raw, { EnableCharsetFallback: true, EnableMapping: true });
  const { output } = await runPipeline(parsed.html || '', {
    imageMap: parsed.imageMap || {},
    OutputCleanupMode: 'safe',
    UnitStrategy: 'normalize-safe',
    ExportStylesMode: 'deferred'
  });
  console.log = realLog;
  console.info = realInfo;
  console.warn = realWarn;

  const doc = new DOMParser().parseFromString(output, 'text/html');
  const compactStyle = doc.querySelector('style[data-onc-compact-typography]')?.textContent || '';
  const loader = doc.querySelector('script[data-onc-export-styles-loader="v1"]')?.textContent || '';

  assert.equal(doc.querySelector('link[rel="stylesheet"][href="assets/tailwind-output.css"]'), null, 'deferred export should not link the Tailwind bundle');
  assert.equal(doc.querySelector('style[data-onc-inline-stylesheet="assets/tailwind-output.css"]'), null, 'deferred export should not inline the Tailwind bundle');
  assert(output.length <= 5800, `expected DevToys deferred export HTML to stay under 5800 bytes, got ${output.length}`);
  assert(compactStyle.length <= 700, `expected compact typography block to stay under 700 bytes, got ${compactStyle.length}`);
  assert(loader.length <= 300, `expected deferred export loader to stay under 300 bytes, got ${loader.length}`);
}

{
  const realLog = console.log;
  const realInfo = console.info;
  const realWarn = console.warn;
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  const raw = fs.readFileSync('./Tests/DevToys.mht', 'latin1');
  const parsed = parseMht(raw, { EnableCharsetFallback: true, EnableMapping: true });
  const { output } = await runPipeline(parsed.html || '', {
    imageMap: parsed.imageMap || {},
    OutputCleanupMode: 'safe',
    UnitStrategy: 'normalize-safe',
    ExportStylesMode: 'deferred',
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ConvertedPageThemeToggleEnabled: true
  });
  console.log = realLog;
  console.info = realInfo;
  console.warn = realWarn;

  const doc = new DOMParser().parseFromString(output, 'text/html');

  assert(doc.querySelector('#onc-toolbar-style'), 'deferred toolbar export should inline toolbar CSS for standalone exports');
  assert(doc.querySelector('#onc-toolbar-script'), 'deferred toolbar export should inline toolbar script for standalone exports');
  assert(doc.querySelector('#onc-converted-theme-style'), 'deferred toolbar export should inline converted theme CSS for standalone exports');
  assert(doc.querySelector('#onc-converted-theme-script'), 'deferred toolbar export should inline converted theme script for standalone exports');
  assert.equal(/enhancements\.js/i.test(output), false, 'deferred standalone toolbar export should not depend on enhancements.js');
  assert(output.length <= 36000, `expected DevToys deferred export with toolbar/theme to stay under 36000 bytes, got ${output.length}`);
}

console.log('export-size-budget: PASS');