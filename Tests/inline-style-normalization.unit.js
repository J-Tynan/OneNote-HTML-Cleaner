import assert from 'assert';
import { JSDOM } from 'jsdom';

// polyfill DOMParser/NodeFilter for tests
if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
  global.NodeFilter = dom.window.NodeFilter;
}

// import migration helpers
const {
  migrateInlineStylesToUtilities,
  parseStyle,
} = await import('../src/pipeline/inlineStyleMigration.js');

// silence logging in imports
const { setEnabled } = await import('../src/logging.js');
setEnabled(false);

function makeDoc(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

function getStyle(el) {
  return el.getAttribute('style');
}

console.log('running inline-style-normalization unit tests');

// parseStyle edge cases
{
  const samples = [
    'font-size:12px; font-weight : bold; ; margin-top: 4px;;',
    'color:red;;invalid;prop',
    '   ; ;font-family:Arial;'
  ];
  const results = samples.map(s => parseStyle(s));
  assert(results[0].some(e => e.prop === 'font-size' && e.value === '12px'));
  assert(results[0].some(e => e.prop === 'font-weight' && e.value === 'bold'));
  assert(results[1].some(e => e.prop === 'color' && e.value === 'red'));
  assert(!results[1].some(e => e.prop === 'invalid')); // invalid entry ignored
  assert(results[2].length === 1 && results[2][0].prop === 'font-family');
}

// migration without removing declarations
{
  const html = '<p style="font-family:Calibri; font-size:16px; font-weight:700; margin-top:8px; margin-bottom:4px; color:blue"></p>';
  const doc = makeDoc(html);
  const logs = migrateInlineStylesToUtilities(doc, { selector: 'p', removeMigratedDeclarations: false });
  const p = doc.querySelector('p');
  assert(p.className.includes('font-sans'));
  assert(p.className.includes('text-base')); // 16px -> text-base
  assert(p.className.includes('font-bold'));
  assert(p.className.match(/mt-2/)); // 8px -> spacing token 2
  assert(p.className.match(/mb-1/)); // 4px -> token 1
  // original style should remain unchanged except order may differ
  const style = getStyle(p);
  assert(style.includes('color: blue'));
  assert(style.includes('font-family: Calibri'));
  assert(logs.some(l => l.step === 'migrateInlineStylesToUtilities' && l.declarationsMigrated === 5));
}

// migration with declarations removed
{
  const html = '<div style="font-family:Arial; font-size:12pt; margin-top:12px;"><span style="font-weight: 600;">x</span></div>';
  const doc = makeDoc(html);
  migrateInlineStylesToUtilities(doc, { selector: '[style]', removeMigratedDeclarations: true });
  const div = doc.querySelector('div');
  assert(!div.hasAttribute('style')); // all migrated
  assert(div.className.includes('font-sans'));
  assert(div.className.includes('text-base')); // 12pt -> 16px -> text-base
  assert(div.className.match(/mt-3/));
  const span = doc.querySelector('span');
  assert(!span.hasAttribute('style')); // weight migrated
  assert(span.className.includes('font-semibold') || span.className.includes('font-medium') || span.className.includes('font-bold'));
}

// custom selector
{
  const html = '<p data-test style="font-family:Georgia;"></p><p style="font-family:Times;"></p>';
  const doc = makeDoc(html);
  migrateInlineStylesToUtilities(doc, { selector: '[data-test]', removeMigratedDeclarations: true });
  const first = doc.querySelector('p[data-test]');
  const second = doc.querySelectorAll('p')[1];
  assert(first.className.includes('font-sans'));
  assert(!second.className);
}

console.log('inline-style-normalization: PASS');
