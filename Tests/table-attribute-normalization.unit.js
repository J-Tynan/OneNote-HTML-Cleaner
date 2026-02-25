import assert from 'assert';
import { JSDOM } from 'jsdom';

// polyfill DOMParser/NodeFilter for node
if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
  global.NodeFilter = dom.window.NodeFilter;
}

console.log('running table attribute normalization unit tests');

const { normalizeTableAttributes } = await import('../src/pipeline/sanitize.js');

function apply(html) {
  const dom = new JSDOM(html).window.document;
  const logs = normalizeTableAttributes(dom);
  return { doc: dom, html: dom.documentElement.outerHTML, logs };
}

// case helpers (string tests still useful for snapshots)
function contains(hay, needle) {
  if (!hay.includes(needle)) throw new Error(`expected to contain \"${needle}\"`);
}
function notContains(hay, needle) {
  if (hay.includes(needle)) throw new Error(`expected NOT to contain \"${needle}\"`);
}

function assertNoAttr(el, attr) {
  if (el.hasAttribute(attr)) throw new Error(`element should not have ${attr}`);
}
function assertHasDataLegacy(el, attr, value) {
  const name = `data-legacy-${attr}`;
  if (!el.hasAttribute(name) || el.getAttribute(name) !== value) {
    throw new Error(`expected ${name}="${value}"`);
  }
}

// 1. summary and Office xmlns removed
(() => {
  const input = `<html><body><table summary=\"mso-foo\" xmlns=\"http://schemas.microsoft.com/office/onenote\"><tr><td>cell</td></tr></table></body></html>`;
  const { doc, html } = apply(input);
  const tbl = doc.querySelector('table');
  assertNoAttr(tbl, 'summary');
  assertNoAttr(tbl, 'xmlns');
  contains(html, '<td>cell</td>');
  console.log('case1 pass');
})();

// 2. legacy table attrs removed and preserved as data-legacy
(() => {
  const input = `<html><body><table border=\"1\" cellpadding=\"2\" cellspacing=\"3\"><tr><td>c</td></tr></table></body></html>`;
  const { doc, html } = apply(input);
  const tbl = doc.querySelector('table');
  assertNoAttr(tbl, 'border');
  assertNoAttr(tbl, 'cellpadding');
  assertNoAttr(tbl, 'cellspacing');
  assertHasDataLegacy(tbl, 'border', '1');
  assertHasDataLegacy(tbl, 'cellpadding', '2');
  assertHasDataLegacy(tbl, 'cellspacing', '3');
  console.log('case2 pass');
})();

// 3. preserve svg namespace
(() => {
  const input = `<html><body><svg xmlns=\"http://www.w3.org/2000/svg\"></svg><table xmlns=\"http://schemas.microsoft.com/office/office\"></table></body></html>`;
  const { doc, html } = apply(input);
  const svg = doc.querySelector('svg');
  const tbl = doc.querySelector('table');
  assert(svg.hasAttribute('xmlns'), 'svg should still have xmlns');
  assertNoAttr(tbl, 'xmlns');
  console.log('case3 pass');
})();

console.log('table-attribute-normalization: PASS');
