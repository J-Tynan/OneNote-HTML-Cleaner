// Tests/list-duplication-regression.js
// Regression test for bug where malformed nested lists produced an
// extra bullet/number combination after conversion.

import assert from 'assert';
import fs from 'fs';
import { JSDOM } from 'jsdom';
const { parseMht } = await import('../src/pipeline/mht.js');
const { ensureListStructure } = await import('../src/pipeline/sanitize.js');

console.log('running list duplication regression test');

// use the fixture that produced duplicated bullets previously
const raw = fs.readFileSync('Tests/Communicate using Markdown.mht', 'binary');
const parsed = parseMht(raw, { EnableCharsetFallback: true, EnableMapping: true });

// apply our list-structure repair directly using jsdom
const dom = new JSDOM(parsed.html || '').window.document;
// run the function under test
ensureListStructure(dom);

// serialize back to HTML (doctype optional)
const output = dom.documentElement.outerHTML;

// check for the problematic structure that used to exist
assert(!output.includes('<ul><li><ol'), 'output should not contain wrapped <ul><li><ol> pattern');
assert(!output.match(/<ul[^>]*>\s*<ol/), 'there should be no <ul> directly nesting an <ol>');

// additionally ensure no <li> begins with an explicit bullet glyph
const bulletStart = /<li[^>]*>\s*[•·\u2022\u00B7\-]+/;
assert(!bulletStart.test(output), 'list items should not start with an explicit bullet glyph');

console.log('list-duplication-regression: PASS');
