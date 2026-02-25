import assert from 'assert';
import { JSDOM } from 'jsdom';

// polyfill DOMParser/NodeFilter
if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
  global.NodeFilter = dom.window.NodeFilter;
}

const { collapseInlineStyleDuplicates } = await import('../src/pipeline/sanitize.js');
const { setEnabled } = await import('../src/logging.js');
setEnabled(false);

function makeDoc(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

console.log('running inline-style-collapse unit tests');

// case: collapse occurs when threshold reached
{
  const html = `<div>
    <p style="font-family:Calibri; font-size:14px"></p>
    <p style="font-family:Calibri; font-size:14px"></p>
    <p style="font-family:Calibri; font-size:14px"></p>
  </div>`;
  const doc = makeDoc(html);
  const logs = collapseInlineStyleDuplicates(doc, { minCount: 3, removeMigratedDeclarations: true });
  const parent = doc.querySelector('div');
  assert(parent.className.includes('font-sans'), 'parent should get font-sans class');
  assert(parent.className.includes('text-sm'), 'parent should get text-sm class');
  const children = doc.querySelectorAll('p');
  children.forEach(c => assert(!c.hasAttribute('style')));
  assert(logs.some(l => l.step === 'CollapseInlineStylesSummary'));
}

// case: threshold not met -> no collapse
{
  const html = `<section>
    <span style="font-weight:bold"></span>
    <span style="font-weight:bold"></span>
  </section>`;
  const doc = makeDoc(html);
  const logs = collapseInlineStyleDuplicates(doc, { minCount: 3, removeMigratedDeclarations: true });
  const parent = doc.querySelector('section');
  assert(!parent.className, 'no class added');
  assert(logs.length === 0);
}

// case: collapse but don't remove declarations
{
  const html = `<div>
    <a style="margin-top:8px"></a>
    <a style="margin-top:8px"></a>
    <a style="margin-top:8px"></a>
  </div>`;
  const doc = makeDoc(html);
  collapseInlineStyleDuplicates(doc, { minCount: 3, removeMigratedDeclarations: false });
  const parent = doc.querySelector('div');
  assert(parent.className.match(/mt-2/));
  const children = doc.querySelectorAll('a');
  children.forEach(c => assert(c.getAttribute('style').includes('margin-top:8px')));
}

console.log('inline-style-collapse: PASS');
