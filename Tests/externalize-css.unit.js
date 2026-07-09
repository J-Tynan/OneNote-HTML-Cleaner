import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { externalizeCss } from '../src/pipeline/sanitize.js';

function makeDoc(html) {
  return new JSDOM(html).window.document;
}

function classNames(node) {
  return String(node && node.className || '')
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

(function main() {
  console.log('running externalize-css unit tests');

  {
    const doc = makeDoc('<html><head><style>.notes{color:blue}</style></head><body><p style="font-size:12pt; color: red; margin-left: 8px">Hello</p></body></html>');
    const result = externalizeCss(doc, { externalizeCssEnabled: true, externalizeCssMode: 'shared' });
    const p = doc.querySelector('p');

    assert(result && typeof result.cssText === 'string' && result.cssText.length > 0, 'cssText should be returned when enabled');
    assert.equal(doc.querySelectorAll('style').length, 0, 'style tags should be removed from html');
    assert(p && p.hasAttribute('class'), 'inline style should be replaced with generated class');
    assert.equal(p && p.hasAttribute('style'), false, 'inline style attribute should be removed');
    assert(result.cssText.includes('.notes{color:blue}') || result.cssText.includes('.notes { color:blue'), 'existing style block should be extracted');
    assert(result.cssText.includes('.onc-font-size-12pt'), 'font-size declaration should use a readable class name');
    assert(result.cssText.includes('.onc-color-red'), 'color declaration should use a readable class name');
    assert(result.cssText.includes('.onc-margin-left-8px'), 'spacing declaration should use a readable class name');
    assert.deepEqual(classNames(p), ['onc-color-red', 'onc-font-size-12pt', 'onc-margin-left-8px'], 'element should receive one class per declaration');
  }

  {
    const doc = makeDoc('<html><head><style>.dup{color:blue}</style><style>\n.dup{color:blue}\n</style></head><body><p style="color:red; font-size:12pt">A</p><p style="font-size:12pt; color:red">B</p></body></html>');
    const result = externalizeCss(doc, { externalizeCssEnabled: true, externalizeCssMode: 'shared' });
    const paragraphs = Array.from(doc.querySelectorAll('p'));

    assert(paragraphs.length === 2, 'expected two paragraph nodes');
    assert.deepEqual(classNames(paragraphs[0]), classNames(paragraphs[1]), 'equivalent inline declarations should map to the same class set');
    assert(result.cssText.includes('.onc-color-red'), 'generated declaration should use a readable class name');
    assert(result.cssText.includes('.onc-font-size-12pt'), 'generated declaration should use a readable class name');
    assert.equal((result.cssText.match(/\.dup\s*\{\s*color:blue\s*\}/g) || []).length, 1, 'duplicate extracted style blocks should be consolidated');
  }

  {
    const doc = makeDoc('<html><body><p style="font-size:12pt">Hello</p></body></html>');
    const result = externalizeCss(doc, { externalizeCssEnabled: false, externalizeCssMode: 'shared' });
    const p = doc.querySelector('p');

    assert.equal(result.cssText, '', 'cssText should be empty when disabled');
    assert.equal(p && p.getAttribute('style'), 'font-size:12pt', 'style should remain when disabled');
  }

  console.log('externalize-css: PASS');
})();
