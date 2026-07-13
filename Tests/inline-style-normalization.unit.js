import assert from 'assert';
import { setupNodeTestEnvironment } from './node-test-helper.js';

// import migration helpers
const {
  getUtilityClassForDeclaration,
  isUtilityMappableProperty,
  migrateInlineStylesToUtilities,
  parseStyle,
} = await import('../src/pipeline/inlineStyleMigration.js');
const {
  compactRepeatedTypographyClasses
} = await import('../src/pipeline/sanitize.js');

await setupNodeTestEnvironment();

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

// shared declaration-to-class mapping contract
{
  assert.equal(getUtilityClassForDeclaration('font-family', 'Calibri'), 'font-sans');
  assert.equal(getUtilityClassForDeclaration('font-size', '16px'), 'text-base');
  assert.equal(getUtilityClassForDeclaration('font-weight', '700'), 'font-bold');
  assert.equal(getUtilityClassForDeclaration('margin-top', '8px'), 'mt-2');
  assert.equal(getUtilityClassForDeclaration('margin-bottom', '4px'), 'mb-1');
  assert.equal(getUtilityClassForDeclaration('color', 'blue'), null);
  assert.equal(isUtilityMappableProperty('font-size'), true);
  assert.equal(isUtilityMappableProperty('color'), false);
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

// compact repeated typography classes while keeping inline fallback styles
{
  const html = '<html><head></head><body class="font-sans text-base" style="font-family: Calibri; font-size: 11.0pt"><div class="mt-6" style="margin-top: 2rem; margin-left: 2rem"><p class="font-sans text-base" style="margin: 0; font-family: Calibri; font-size: 11.0pt">Body</p><p class="font-sans text-sm" style="margin: 0; font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #666666">Meta</p><h2 class="font-sans text-xl" style="margin: 0; font-family: Calibri; font-size: 16.0pt; color: #1E4E79"><span class="font-bold" style="font-weight: bold">Heading</span></h2><p class="font-sans text-xl" style="margin: 0; font-family: &quot;Calibri Light&quot;; font-size: 20.0pt">Page Title</p><h1 class="converted-page-title font-sans text-xl" style="margin: 0; font-family: &quot;Calibri Light&quot;; font-size: 20.0pt; display: inline-block; padding-right: 1in; padding-bottom: 0.08em; border-bottom: 1px solid #b7b7b7">Document</h1><p class="converted-page-date font-sans text-sm" style="margin: 0; font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #666666">22 September 2025<span class="created-time converted-page-time font-sans text-sm" style="margin: 0; font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #666666; margin-left: 0.75em">15:30</span></p></div></body></html>';
  const doc = makeDoc(html);
  const logs = compactRepeatedTypographyClasses(doc);
  const headStyle = doc.querySelector('style[data-onc-compact-typography]');
  const body = doc.querySelector('body');
  const wrapper = doc.querySelector('div');
  const bodyCopy = doc.querySelector('p');
  const meta = doc.querySelectorAll('p')[1];
  const heading = doc.querySelector('h2');
  const headingSpan = doc.querySelector('span');
  const pageTitle = doc.querySelectorAll('p')[2];
  const pageHeading = doc.querySelector('h1.converted-page-title');
  const dateParagraph = doc.querySelectorAll('p')[3];
  const createdTime = dateParagraph.querySelector('span.created-time');

  assert(headStyle, 'compact typography stylesheet should be injected into the document head');
  assert(headStyle.textContent.includes('.onc-copy{margin:0;font-family:Calibri;font-size:11.0pt;}'));
  assert(headStyle.textContent.includes('.onc-page-title{display:inline-block;padding-right:1in;padding-bottom:0.08em;border-bottom:1px solid #b7b7b7;}'));
  assert(headStyle.textContent.includes('.onc-page-date-tone{color:#666666;}'));
  assert(headStyle.textContent.includes('.onc-page-time{color:#666666;margin-left:0.75em;}'));
  assert(body.className.includes('onc-body'));
  assert(!body.className.includes('font-sans'));
  assert(!body.className.includes('text-base'));
  assert.equal(body.getAttribute('style'), null);
  assert(!wrapper.className.includes('mt-6'));
  assert(bodyCopy.className.includes('onc-copy'));
  assert(!bodyCopy.className.includes('font-sans'));
  assert(!bodyCopy.className.includes('text-base'));
  assert.equal(bodyCopy.getAttribute('style'), null);
  assert(meta.className.includes('onc-meta'));
  assert(!meta.className.includes('text-sm'));
  assert.equal(meta.getAttribute('style'), 'color: #666666');
  assert(heading.className.includes('onc-h1'));
  assert(!heading.className.includes('text-xl'));
  assert.equal(heading.getAttribute('style'), 'color: #1E4E79');
  assert(!headingSpan.className.includes('font-bold'));
  assert.equal(headingSpan.getAttribute('style'), 'font-weight: bold');
  assert(pageTitle.className.includes('onc-title'));
  assert.equal(pageTitle.getAttribute('style'), null);
  assert(pageHeading.className.includes('onc-title'));
  assert(pageHeading.className.includes('onc-page-title'));
  assert.equal(pageHeading.getAttribute('style'), null);
  assert(dateParagraph.className.includes('onc-meta'));
  assert(dateParagraph.className.includes('onc-page-date-tone'));
  assert.equal(dateParagraph.getAttribute('style'), null);
  assert(createdTime.className.includes('onc-meta'));
  assert(createdTime.className.includes('onc-page-time'));
  assert.equal(createdTime.getAttribute('style'), null);
  assert(logs.some((entry) => entry.step === 'CompactRepeatedTypographyClasses' && entry.replacements === 11 && entry.prunedUtilityClasses === 2 && entry.strippedStyleDeclarations === 11));
}

// compact repeated table and alignment declarations while keeping unmatched layout inline
{
  const html = '<html><head></head><body><table style="direction: ltr; border-collapse: collapse; border-style: solid; border-color: #A3A3A3; border-width: 1pt"><tr><td style="border-style: solid; border-color: #A3A3A3; border-width: 1pt; vertical-align: top; width: .9388in; padding: 2.0pt 3.0pt 2.0pt 3.0pt"><p style="text-align: center">Cell</p></td><td style="border-style: solid; border-color: #A3A3A3; border-width: 1pt; vertical-align: top; width: .9798in; padding: 2.0pt 3.0pt 2.0pt 3.0pt"><p style="text-align: right">Right</p></td></tr></table></body></html>';
  const doc = makeDoc(html);
  const logs = compactRepeatedTypographyClasses(doc);
  const styleBlock = doc.querySelector('style[data-onc-compact-typography]');
  const table = doc.querySelector('table');
  const cells = doc.querySelectorAll('td');
  const centered = doc.querySelector('p');
  const right = doc.querySelectorAll('p')[1];

  assert(styleBlock, 'compact fallback stylesheet should be injected for table compaction too');
  assert(styleBlock.textContent.includes('.onc-table{border-collapse:collapse;border-style:solid;border-color:#A3A3A3;border-width:1pt;}'));
  assert(styleBlock.textContent.includes('.onc-cell{border-style:solid;border-color:#A3A3A3;border-width:1pt;vertical-align:top;padding:2.0pt 3.0pt 2.0pt 3.0pt;}'));
  assert(styleBlock.textContent.includes('.onc-center{text-align:center;}'));
  assert(styleBlock.textContent.includes('.onc-right{text-align:right;}'));
  assert(table.className.includes('onc-table'));
  assert.equal(table.getAttribute('style'), 'direction: ltr');
  assert(cells[0].className.includes('onc-cell'));
  assert.equal(cells[0].getAttribute('style'), 'width: .9388in');
  assert(cells[1].className.includes('onc-cell'));
  assert.equal(cells[1].getAttribute('style'), 'width: .9798in');
  assert(centered.className.includes('onc-center'));
  assert.equal(centered.getAttribute('style'), null);
  assert(right.className.includes('onc-right'));
  assert.equal(right.getAttribute('style'), null);
  assert(logs.some((entry) => entry.step === 'CompactRepeatedTypographyClasses' && entry.replacements === 5 && entry.strippedStyleDeclarations === 5));
}

// compact repeated zero-border table and cell declarations while preserving widths and direction
{
  const html = '<html><head></head><body><table style="direction: ltr; border-collapse: collapse; border-style: solid; border-color: #A3A3A3; border-width: 0"><tr><td style="border-style: solid; border-color: #A3A3A3; border-width: 0; vertical-align: top; width: .9388in; padding: 2.0pt 3.0pt 2.0pt 3.0pt"><p style="text-align: right">Cell</p></td><td style="border-style: solid; border-color: #A3A3A3; border-width: 0; vertical-align: top; width: .9798in; padding: 2.0pt 3.0pt 2.0pt 3.0pt"><p>Plain</p></td></tr></table></body></html>';
  const doc = makeDoc(html);
  const logs = compactRepeatedTypographyClasses(doc);
  const styleBlock = doc.querySelector('style[data-onc-compact-typography]');
  const table = doc.querySelector('table');
  const cells = doc.querySelectorAll('td');
  const right = doc.querySelector('p');
  const plain = doc.querySelectorAll('p')[1];

  assert(styleBlock, 'compact fallback stylesheet should be injected for zero-border table compaction');
  assert(styleBlock.textContent.includes('.onc-table-borderless{border-collapse:collapse;border-style:solid;border-color:#A3A3A3;border-width:0;}'));
  assert(styleBlock.textContent.includes('.onc-cell-borderless{border-style:solid;border-color:#A3A3A3;border-width:0;vertical-align:top;padding:2.0pt 3.0pt 2.0pt 3.0pt;}'));
  assert(table.className.includes('onc-table-borderless'));
  assert.equal(table.getAttribute('style'), 'direction: ltr');
  assert(cells[0].className.includes('onc-cell-borderless'));
  assert.equal(cells[0].getAttribute('style'), 'width: .9388in');
  assert(cells[1].className.includes('onc-cell-borderless'));
  assert.equal(cells[1].getAttribute('style'), 'width: .9798in');
  assert(right.className.includes('onc-right'));
  assert.equal(right.getAttribute('style'), null);
  assert.equal(plain.getAttribute('style'), null);
  assert(logs.some((entry) => entry.step === 'CompactRepeatedTypographyClasses' && entry.replacements === 4 && entry.strippedStyleDeclarations === 4));
}

// compact borderless cell declarations even when only width, vertical-align, padding, and border-width remain inline
{
  const html = '<html><head></head><body><table style="direction: ltr; border-collapse: collapse; border-style: solid; border-color: #A3A3A3; border-width: 0"><tr><td style="border-width: 0; vertical-align: top; width: .9388in; padding: 2.0pt 3.0pt 2.0pt 3.0pt"><p class="onc-copy">Cell</p></td><td style="border-width: 0; vertical-align: top; width: .9798in; padding: 2.0pt 3.0pt 2.0pt 3.0pt"><p class="onc-copy">Plain</p></td></tr></table></body></html>';
  const doc = makeDoc(html);
  const logs = compactRepeatedTypographyClasses(doc);
  const styleBlock = doc.querySelector('style[data-onc-compact-typography]');
  const cells = doc.querySelectorAll('td');

  assert(styleBlock, 'compact fallback stylesheet should be injected for lightweight borderless cell compaction');
  assert(styleBlock.textContent.includes('.onc-cell-borderless-lite{border-width:0;vertical-align:top;padding:2.0pt 3.0pt 2.0pt 3.0pt;}'));
  assert(cells[0].className.includes('onc-cell-borderless-lite'));
  assert.equal(cells[0].getAttribute('style'), 'width: .9388in');
  assert(cells[1].className.includes('onc-cell-borderless-lite'));
  assert.equal(cells[1].getAttribute('style'), 'width: .9798in');
  assert(logs.some((entry) => entry.step === 'CompactRepeatedTypographyClasses' && entry.replacements === 3 && entry.strippedStyleDeclarations === 3));
}

// remove empty style attributes and dedupe class tokens left behind by compaction-adjacent transforms
{
  const html = '<html><head></head><body><p class="onc-copy onc-copy  extra" style="">Body</p><span class=" helper   helper " style="   "> </span></body></html>';
  const doc = makeDoc(html);
  const logs = compactRepeatedTypographyClasses(doc);
  const p = doc.querySelector('p');
  const span = doc.querySelector('span');

  assert.equal(p.getAttribute('class'), 'onc-copy extra');
  assert.equal(p.hasAttribute('style'), false);
  assert.equal(span.getAttribute('class'), 'helper');
  assert.equal(span.hasAttribute('style'), false);
  assert(logs.some((entry) => entry.step === 'CompactRepeatedTypographyClasses' && entry.emptyStyleRemoved === 2 && entry.classAttributesDeduped === 2));
}

// compact repeated ordered-list typography while preserving list semantics and item color
{
  const html = '<html><head></head><body><ol type="1" style="direction: ltr; unicode-bidi: embed; margin-top: 0; margin-bottom: 0; font-family: Calibri; font-size: 11.0pt; font-weight: normal; font-style: normal; margin-left: 0.35em; padding-left: 1.2em; padding-inline-start: 1.2em" class="mt-0 mb-0 font-sans text-base font-normal list-decimal list-outside pl-5"><li value="1" style="margin-top: 0; margin-bottom: 0; vertical-align: middle; color: #2E75B5" class="mt-0 mb-0"><span style="font-family: Calibri; font-size: 11.0pt; font-weight: normal; font-style: normal" class="font-sans text-base font-normal">Item 1</span></li></ol></body></html>';
  const doc = makeDoc(html);
  const logs = compactRepeatedTypographyClasses(doc);
  const styleBlock = doc.querySelector('style[data-onc-compact-typography]');
  const list = doc.querySelector('ol');
  const item = doc.querySelector('li');
  const span = doc.querySelector('span');

  assert(styleBlock, 'compact fallback stylesheet should be injected for list compaction');
  assert(styleBlock.textContent.includes('.onc-list{direction:ltr;unicode-bidi:embed;margin-top:0;margin-bottom:0;font-family:Calibri;font-size:11.0pt;font-weight:400;font-style:normal;margin-left:0.35em;padding-left:1.2em;padding-inline-start:1.2em;}'));
  assert(styleBlock.textContent.includes('.onc-list-item{margin-top:0;margin-bottom:0;vertical-align:middle;}'));
  assert(styleBlock.textContent.includes('.onc-inline-copy{font-family:Calibri;font-size:11.0pt;font-weight:400;font-style:normal;}'));
  assert(list.className.includes('onc-list'));
  assert(!list.className.includes('mt-0'));
  assert(!list.className.includes('font-sans'));
  assert(!list.className.includes('text-base'));
  assert(!list.className.includes('font-normal'));
  assert.equal(list.getAttribute('style'), null);
  assert(item.className.includes('onc-list-item'));
  assert(!item.className.includes('mt-0'));
  assert.equal(item.getAttribute('style'), 'color: #2E75B5');
  assert(span.className.includes('onc-inline-copy'));
  assert.equal(span.getAttribute('style'), null);
  assert(logs.some((entry) => entry.step === 'CompactRepeatedTypographyClasses' && entry.replacements === 3 && entry.strippedStyleDeclarations === 3));
}

// compact repeated bold ordered-list typography while preserving semantics and item color
{
  const html = '<html><head></head><body><ol type="1" style="direction: ltr; unicode-bidi: embed; margin-top: 0; margin-bottom: 0; font-family: Calibri; font-size: 11.0pt; font-weight: bold; font-style: normal; margin-left: 0.35em; padding-left: 1.2em; padding-inline-start: 1.2em" class="mb-0 font-sans text-base list-decimal list-outside"><li value="2" style="margin-top: 0; margin-bottom: 0; vertical-align: middle; font-weight: bold; color: #2E75B5" class="onc-list-item"><span style="font-weight: normal; font-family: Calibri; font-size: 11.0pt" class="font-normal font-sans text-base">B</span></li></ol></body></html>';
  const doc = makeDoc(html);
  const logs = compactRepeatedTypographyClasses(doc);
  const styleBlock = doc.querySelector('style[data-onc-compact-typography]');
  const list = doc.querySelector('ol');
  const item = doc.querySelector('li');
  const span = doc.querySelector('span');

  assert(styleBlock, 'compact fallback stylesheet should be injected for bold list compaction');
  assert(styleBlock.textContent.includes('.onc-list-strong{direction:ltr;unicode-bidi:embed;margin-top:0;margin-bottom:0;font-family:Calibri;font-size:11.0pt;font-weight:700;font-style:normal;margin-left:0.35em;padding-left:1.2em;padding-inline-start:1.2em;}'));
  assert(styleBlock.textContent.includes('.onc-list-item-strong{margin-top:0;margin-bottom:0;vertical-align:middle;font-weight:700;}'));
  assert(styleBlock.textContent.includes('.onc-inline-copy-reset{font-family:Calibri;font-size:11.0pt;font-weight:400;}'));
  assert(list.className.includes('onc-list-strong'));
  assert.equal(list.getAttribute('style'), null);
  assert(item.className.includes('onc-list-item-strong'));
  assert.equal(item.getAttribute('style'), 'color: #2E75B5');
  assert(span.className.includes('onc-inline-copy-reset'));
  assert.equal(span.getAttribute('style'), null);
  assert(logs.some((entry) => entry.step === 'CompactRepeatedTypographyClasses' && entry.replacements === 3 && entry.strippedStyleDeclarations === 3));
}

// compact unordered-list wrappers and simple inline copy spans while preserving bullet styling and item color
{
  const html = '<html><head></head><body><ul style="direction: ltr; unicode-bidi: embed; margin-top: 0; margin-bottom: 0; margin-left: 0.35em; padding-left: 1.2em; padding-inline-start: 1.2em" class="list-disc list-outside mb-0"><li style="color: #000000; margin-top: 0; margin-bottom: 0; vertical-align: middle" class="mb-0"><img src="data:image/png;base64,AA==" alt="Question"><span style="font-family: Calibri; font-size: 11.0pt" class="font-sans text-base">Prompt</span></li></ul></body></html>';
  const doc = makeDoc(html);
  const logs = compactRepeatedTypographyClasses(doc);
  const styleBlock = doc.querySelector('style[data-onc-compact-typography]');
  const list = doc.querySelector('ul');
  const item = doc.querySelector('li');
  const span = doc.querySelector('span');

  assert(styleBlock, 'compact fallback stylesheet should be injected for unordered-list compaction');
  assert(styleBlock.textContent.includes('.onc-bullet-list{direction:ltr;unicode-bidi:embed;margin-top:0;margin-bottom:0;margin-left:0.35em;padding-left:1.2em;padding-inline-start:1.2em;}'));
  assert(styleBlock.textContent.includes('.onc-inline-copy-lite{font-family:Calibri;font-size:11.0pt;}'));
  assert(list.className.includes('onc-bullet-list'));
  assert(!list.className.includes('mb-0'));
  assert.equal(list.getAttribute('style'), null);
  assert(item.className.includes('onc-list-item'));
  assert.equal(item.getAttribute('style'), 'color: #000000');
  assert(span.className.includes('onc-inline-copy-lite'));
  assert.equal(span.getAttribute('style'), null);
  assert(logs.some((entry) => entry.step === 'CompactRepeatedTypographyClasses' && entry.replacements === 3 && entry.strippedStyleDeclarations === 3));
}

console.log('inline-style-normalization: PASS');
