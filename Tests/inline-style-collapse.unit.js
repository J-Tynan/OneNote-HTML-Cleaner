import assert from 'assert';
import { setupNodeTestEnvironment } from './node-test-helper.js';

const { collapseInlineStyleDuplicates } = await import('../src/pipeline/sanitize.js');

await setupNodeTestEnvironment();

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

// case: canonicalized matching should collapse when declaration order differs
{
  const html = `<div>
    <p style="font-size:14px; font-family:Calibri"></p>
    <p style="font-family:Calibri; font-size:14px"></p>
    <p style="font-size:14px; font-family:Calibri"></p>
  </div>`;
  const doc = makeDoc(html);
  collapseInlineStyleDuplicates(doc, { minCount: 3, removeMigratedDeclarations: true });
  const parent = doc.querySelector('div');
  assert(parent.className.includes('font-sans'), 'parent should get font-sans class from canonicalized group');
  assert(parent.className.includes('text-sm'), 'parent should get text-sm class from canonicalized group');
  const children = doc.querySelectorAll('p');
  children.forEach(c => assert(!c.hasAttribute('style')));
}

// case: canonicalized matching should normalize prop/value case and spacing
{
  const html = `<div>
    <p style="FONT-WEIGHT : BOLD; margin-top : 8PX"></p>
    <p style="font-weight:bold; margin-top:8px"></p>
    <p style="font-weight: bold; margin-top: 8px"></p>
  </div>`;
  const doc = makeDoc(html);
  collapseInlineStyleDuplicates(doc, { minCount: 3, removeMigratedDeclarations: true });
  const parent = doc.querySelector('div');
  assert(parent.className.includes('font-bold'), 'parent should get normalized font weight class');
  assert(parent.className.match(/mt-2/), 'parent should get normalized margin class');
}

console.log('inline-style-collapse: PASS');
