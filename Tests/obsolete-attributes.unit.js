import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import * as sanitize from '../src/pipeline/sanitize.js';

const dom = new JSDOM('');
if (!global.DOMParser) global.DOMParser = dom.window.DOMParser;
if (!global.NodeFilter) global.NodeFilter = dom.window.NodeFilter;

function sanitizeDoc(html) {
  const doc = new JSDOM(html).window.document;
  sanitize.removeOfficeArtifacts(doc);
  sanitize.normalizeTableAttributes(doc);
  return doc;
}

(function main() {
  console.log('running obsolete-attribute unit tests');

  {
    const doc = sanitizeDoc('<html><body><table summary="Quarterly revenue"><tr><td>Q1</td></tr></table></body></html>');
    const table = doc.querySelector('table');
    assert(table, 'table should exist');
    assert.equal(table.hasAttribute('summary'), false, 'table summary should be removed');
    assert.equal(table.getAttribute('data-legacy-summary'), 'Quarterly revenue', 'meaningful summary should move to data-legacy-summary');
  }

  {
    const doc = sanitizeDoc('<html><body><table summary="mso-table-summary"><tr><td>X</td></tr></table></body></html>');
    const table = doc.querySelector('table');
    assert(table, 'table should exist');
    assert.equal(table.hasAttribute('summary'), false, 'office summary should be removed');
    assert.equal(table.hasAttribute('data-legacy-summary'), false, 'office summary should not be preserved');
  }

  {
    const doc = sanitizeDoc('<html><body><div summary="legacy-hint">Text</div></body></html>');
    const div = doc.querySelector('div');
    assert(div, 'div should exist');
    assert.equal(div.hasAttribute('summary'), false, 'non-table summary should be removed');
  }

  {
    const doc = sanitizeDoc('<html><body><div xmlns="http://schemas.microsoft.com/office/word">Text</div></body></html>');
    const div = doc.querySelector('div');
    assert(div, 'div should exist');
    assert.equal(div.hasAttribute('xmlns'), false, 'office namespace URI should be removed');
  }

  {
    const doc = sanitizeDoc('<html><body><div xmlns="http://www.w3.org/1999/xhtml">Text</div></body></html>');
    const div = doc.querySelector('div');
    assert(div, 'div should exist');
    assert.equal(div.getAttribute('xmlns'), 'http://www.w3.org/1999/xhtml', 'non-office namespace URI should remain');
  }

  console.log('obsolete-attributes: PASS');
})();
