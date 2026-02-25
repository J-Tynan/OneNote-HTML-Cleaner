import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

// Ensure DOMParser/NodeFilter available (same as other node tests)
if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
  global.NodeFilter = dom.window.NodeFilter;
}

// load pipeline helpers
const { parseMht } = await import('../src/pipeline/mht.js');
const { runPipeline } = await import('../src/pipeline/pipeline.js');
// suppress logging to keep output focused; see src/logging.js
const { setEnabled } = await import('../src/logging.js');
setEnabled(false);

console.log('running C0-control-character pipeline compliance test');

// scan MHT fixtures directly (any .mht in Tests root)
const fixtures = fs
  .readdirSync('Tests')
  .filter(f => f.match(/\.mht$/i))
  .map(f => path.join('Tests', f));

if (fixtures.length === 0) {
  console.warn('no .mht fixtures found to test');
  process.exit(0);
}

// regex for control characters except TAB/LF/CR
const forbiddenRe = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
let overallFail = false;

for (const fixture of fixtures) {
  const raw = fs.readFileSync(fixture, 'binary');
  const parsed = parseMht(raw, { EnableCharsetFallback: true });
  const htmlInput = parsed.html || '';

  let { output } = await runPipeline(htmlInput, { EnableCharsetFallback: true });
  // allow manual fault injection for demonstration/debugging
  if (process.env.FORCE_C0_TEST && !overallFail) {
    output = '\u0001' + output;
  }
  const matches = [];
  let m;
  while ((m = forbiddenRe.exec(output))) {
    const idx = m.index;
    const code = output.charCodeAt(idx);
    matches.push({ index: idx, code });
  }
  if (matches.length) {
    overallFail = true;
    for (const { index, code } of matches) {
      const hex = code.toString(16).padStart(4, '0');
      const snippet = output
        .slice(Math.max(0, index - 5), index + 5)
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
      console.error(
        `${path.basename(fixture)}: forbidden C0 U+${hex} at index ${index} snippet="${snippet}"`
      );
    }
  } else {
    console.log(`${path.basename(fixture)}: OK`);
  }
}

process.exit(overallFail ? 1 : 0);
