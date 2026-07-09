import assert from 'assert';
import { JSDOM } from 'jsdom';
import { ensureDomParserGlobals } from './node-test-helper.js';

ensureDomParserGlobals();

console.log('running table attribute normalization unit tests');

const {
  normalizeTableAttributes,
  normalizeLegacyAttributes,
  normalizeTableCellParagraphMargins
} = await import('../src/pipeline/sanitize.js');

function apply(html) {
  const doc = new JSDOM(html).window.document;
  const logs = [];
  logs.push(...normalizeTableAttributes(doc));
  logs.push(...normalizeTableCellParagraphMargins(doc));
  logs.push(...normalizeLegacyAttributes(doc, { removeLegacyDataAttrs: true }));
  return { doc, html: doc.documentElement.outerHTML, logs };
}

function contains(hay, needle) {
  if (!hay.includes(needle)) throw new Error(`expected to contain "${needle}"`);
}

function assertNoAttr(el, attr) {
  if (el.hasAttribute(attr)) throw new Error(`element should not have ${attr}`);
}

(() => {
  const input = `<html><body><table summary="mso-foo" xmlns="http://schemas.microsoft.com/office/onenote"><tr><td>cell</td></tr></table></body></html>`;
  const { doc, html } = apply(input);
  const table = doc.querySelector('table');
  assertNoAttr(table, 'summary');
  assertNoAttr(table, 'xmlns');
  contains(html, '<td>cell</td>');
  console.log('case1 pass');
})();

(() => {
  const input = `<html><body><table border="1" cellpadding="2" cellspacing="3"><tr><td>c</td></tr></table></body></html>`;
  const { doc } = apply(input);
  const table = doc.querySelector('table');
  assertNoAttr(table, 'border');
  assertNoAttr(table, 'cellpadding');
  assertNoAttr(table, 'cellspacing');
  assertNoAttr(table, 'data-legacy-border');
  assertNoAttr(table, 'data-legacy-cellpadding');
  assertNoAttr(table, 'data-legacy-cellspacing');
  console.log('case2 pass');
})();

(() => {
  const input = `<html><body><svg xmlns="http://www.w3.org/2000/svg"></svg><table xmlns="http://schemas.microsoft.com/office/office"></table></body></html>`;
  const { doc } = apply(input);
  const svg = doc.querySelector('svg');
  const table = doc.querySelector('table');
  assert(svg.hasAttribute('xmlns'), 'svg should still have xmlns');
  assertNoAttr(table, 'xmlns');
  console.log('case3 pass');
})();

(() => {
  const input = `<html><body><ul type="disc"><li>Item</li></ul><div style="font-family: Calibri; font-size: 11pt; font-family: Calibri; border-width:100%">X</div></body></html>`;
  const { doc } = apply(input);
  const ul = doc.querySelector('ul');
  const div = doc.querySelector('div');
  assert(ul, 'ul should exist');
  assert.equal(ul.hasAttribute('type'), false, 'ul type should be removed');
  assert((ul.getAttribute('class') || '').includes('list-disc'), 'ul should get list-disc class');
  const style = div.getAttribute('style') || '';
  assert(!/border-width\s*:\s*100%/.test(style), 'invalid border-width percentage should be removed');
  const ffMatches = style.match(/font-family\s*:/g) || [];
  assert.equal(ffMatches.length, 1, 'duplicate font-family declarations should be deduped');
  console.log('case4 pass');
})();

(() => {
  const input = `<html><body><table border="1" cellpadding="2" cellspacing="3"><thead><tr><th><p>Head</p></th></tr></thead><tbody><tr><td><p>Body</p></td></tr></tbody><tfoot><tr><td><p style="margin-top:1em">Footer</p></td></tr></tfoot></table></body></html>`;
  const { doc, logs } = apply(input);
  const table = doc.querySelector('table');
  const headParagraph = doc.querySelector('thead th > p');
  const bodyParagraph = doc.querySelector('tbody td > p');
  const footParagraph = doc.querySelector('tfoot td > p');

  assert(table, 'table should exist');
  assertNoAttr(table, 'border');
  assertNoAttr(table, 'cellpadding');
  assertNoAttr(table, 'cellspacing');
  assert.equal(headParagraph.getAttribute('style'), 'margin: 0');
  assert.equal(bodyParagraph.getAttribute('style'), 'margin: 0');
  assert(/margin-top\s*:\s*1em/i.test(footParagraph.getAttribute('style') || ''), 'existing footer paragraph margin should be preserved');
  assert(logs.some((entry) => entry && entry.step === 'NormalizeTableCellParagraphMargins' && entry.updated === 2));
  console.log('case5 pass');
})();

console.log('table-attribute-normalization: PASS');
