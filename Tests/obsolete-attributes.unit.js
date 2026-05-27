import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { ensureDomParserGlobals } from './node-test-helper.js';
import * as sanitize from '../src/pipeline/sanitize.js';

ensureDomParserGlobals();

function sanitizeDoc(html) {
  const doc = new JSDOM(html).window.document;
  sanitize.ensureHead(doc, { defaultTitle: 'Document', defaultLang: 'en' });
  sanitize.removeOfficeArtifacts(doc);
  sanitize.stripObsoleteHeadArtifacts(doc);
  sanitize.normalizeTableAttributes(doc);
  sanitize.normalizeLegacyAttributes(doc, { removeLegacyDataAttrs: true });
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

  {
    const doc = sanitizeDoc('<!doctype html><html xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body><p>Text</p></body></html>');
    const html = doc.querySelector('html');
    assert(html, 'html should exist');
    assert.equal(html.hasAttribute('xmlns'), false, 'legacy REC-html40 namespace should be removed');
    assert.equal(doc.querySelectorAll('meta[http-equiv="Content-Type"]').length, 0, 'redundant content-type meta should be removed');
  }

  console.log('obsolete-attributes: PASS');
})();
