import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { ensureHead } from '../src/pipeline/sanitize.js';

function createDoc(html) {
  const dom = new JSDOM(html);
  return dom.window.document;
}

function getHtmlLang(doc) {
  return (doc.querySelector('html') || doc.documentElement).getAttribute('lang');
}

(function main() {
  console.log('running lang-normalization unit tests');

  {
    const doc = createDoc('<html><head></head><body lang="en-GB">x</body></html>');
    ensureHead(doc, { defaultLang: 'en' });
    assert.equal(getHtmlLang(doc), 'en-GB');
  }

  {
    const doc = createDoc('<html lang="en-US"><head></head><body lang="fr">x</body></html>');
    ensureHead(doc, { defaultLang: 'en' });
    assert.equal(getHtmlLang(doc), 'en-US');
  }

  {
    const doc = createDoc('<html lang="$$"><head></head><body lang="fr-CA">x</body></html>');
    ensureHead(doc, { defaultLang: 'en' });
    assert.equal(getHtmlLang(doc), 'fr-CA');
  }

  {
    const doc = createDoc('<html lang="bad--value"><head></head><body>x</body></html>');
    ensureHead(doc, { defaultLang: 'en-GB' });
    assert.equal(getHtmlLang(doc), 'en-GB');
  }

  {
    const doc = createDoc('<html><head></head><body>x</body></html>');
    ensureHead(doc, { defaultLang: '$$' });
    assert.equal(getHtmlLang(doc), 'en');
  }

  console.log('lang-normalization: PASS');
})();
