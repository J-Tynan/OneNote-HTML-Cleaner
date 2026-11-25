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

  {
    const doc = createDoc('<html lang="x-none"><head></head><body lang="X-NONE"><p lang="x-none">Unknown <span lang="fr-CA">French</span><span lang="x-private">Private</span></p></body></html>');
    ensureHead(doc, { defaultLang: 'en-GB' });
    assert.equal(getHtmlLang(doc), 'en-GB');
    assert.equal(doc.body.getAttribute('lang'), null);
    assert.equal(doc.querySelector('p').getAttribute('lang'), null);
    assert.equal(doc.querySelector('span').getAttribute('lang'), 'fr-CA');
    assert.equal(doc.querySelectorAll('span')[1].getAttribute('lang'), 'x-private');
  }

  console.log('lang-normalization: PASS');
})();
