// Tests/list-duplication-regression.js
// Regression test for bug where malformed nested lists produced an
// extra bullet/number combination after conversion.

import assert from 'assert';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { ensureDomParserGlobals } from './node-test-helper.js';
const { parseMht } = await import('../src/pipeline/mht.js');
const { dedupeLists, ensureListStructure } = await import('../src/pipeline/sanitize.js');
import { FIXTURE_FILES, resolveFixturePath } from './fixtures.js';

ensureDomParserGlobals();

console.log('running list duplication regression test');

// use the fixture that produced duplicated bullets previously
const raw = fs.readFileSync(resolveFixturePath(FIXTURE_FILES.COMMUNICATE_MARKDOWN), 'binary');
const parsed = parseMht(raw, { EnableCharsetFallback: true, EnableMapping: true });

// run the full pipeline to ensure end-to-end behavior including fixLists +
// dedupeLists step; this also covers the worker/main-thread path.
const { runPipeline } = await import('../src/pipeline/pipeline.js');
const { output, logs } = await runPipeline(parsed.html || '', { EnableCharsetFallback: true });

// the pipeline already runs ensureListStructure and our new dedupe pass.
// we'll still exercise ensureListStructure directly to guard the isolated
// function as before.

// apply our list-structure repair directly using jsdom
const dom = new JSDOM(parsed.html || '').window.document;
ensureListStructure(dom);
const isolated = dom.documentElement.outerHTML;

function checkOutput(html) {
  // check for the problematic structure that used to exist
  assert(!html.includes('<ul><li><ol'), 'output should not contain wrapped <ul><li><ol> pattern');
  assert(!html.match(/<ul[^>]*>\s*<ol/), 'there should be no <ul> directly nesting an <ol>');
  // additionally ensure no <li> begins with an explicit bullet glyph
  const bulletStart = /<li[^>]*>\s*[•·\u2022\u00B7\-]+/;
  assert(!bulletStart.test(html), 'list items should not start with an explicit bullet glyph');
}

checkOutput(output);
checkOutput(isolated);

{
  const repeatDoc = new JSDOM('<html><body><main><ul><li>Repeat</li><li>Unique</li><li>Repeat</li><li>Repeat</li></ul></main></body></html>').window.document;
  const dedupeLogs = dedupeLists(repeatDoc);
  const items = Array.from(repeatDoc.querySelectorAll('main > ul > li')).map((li) => li.textContent.trim());
  assert.deepEqual(items, ['Repeat', 'Unique', 'Repeat']);
  assert(dedupeLogs.some((entry) => entry && entry.step === 'dedupeLists' && entry.removed === 1));
}

console.log('list-duplication-regression: PASS');

console.log('list-duplication-regression: PASS');
