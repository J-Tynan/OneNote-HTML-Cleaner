import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { externalizeCss } from '../src/pipeline/sanitize.js';

function makeDoc(html) {
  return new JSDOM(html).window.document;
}

(function main() {
  console.log('running externalize-css unit tests');

  {
    const doc = makeDoc('<html><head><style>.notes{color:blue}</style></head><body><p style="font-size:12pt; color: red">Hello</p></body></html>');
    const result = externalizeCss(doc, { externalizeCssEnabled: true, externalizeCssMode: 'shared' });
    const p = doc.querySelector('p');

    assert(result && typeof result.cssText === 'string' && result.cssText.length > 0, 'cssText should be returned when enabled');
    assert.equal(doc.querySelectorAll('style').length, 0, 'style tags should be removed from html');
    assert(p && p.hasAttribute('class'), 'inline style should be replaced with generated class');
    assert.equal(p && p.hasAttribute('style'), false, 'inline style attribute should be removed');
    assert(result.cssText.includes('.notes{color:blue}') || result.cssText.includes('.notes { color:blue'), 'existing style block should be extracted');
    assert(result.cssText.includes('.extcss-'), 'generated css class rule should be present');
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
