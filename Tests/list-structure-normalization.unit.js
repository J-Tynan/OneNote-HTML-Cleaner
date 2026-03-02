import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { ensureListStructure } from '../src/pipeline/sanitize.js';

function createDoc(html) {
  const dom = new JSDOM(html);
  return dom.window.document;
}

(function main() {
  console.log('running list-structure-normalization unit tests');

  {
    const doc = createDoc('<html><body><main><ul style="direction:ltr"><p>Plan for your appointment:</p><h2>Opening times</h2><div><table><tr><td>Monday</td></tr></table></div></ul></main></body></html>');
    const logs = ensureListStructure(doc);

    const main = doc.querySelector('main');
    assert(main);
    assert.equal(main.querySelectorAll('main > ul').length, 0);
    assert.equal(main.querySelectorAll('main > p').length, 1);
    assert.equal(main.querySelectorAll('main > h2').length, 1);
    assert.equal(main.querySelectorAll('main > div').length, 1);
    assert(logs.some(entry => entry && entry.step === 'UnwrapMalformedListCount' && entry.unwrappedCount === 1));
  }

  {
    const doc = createDoc('<html><body><main><ul><li>One</li><li>Two</li></ul></main></body></html>');
    const logs = ensureListStructure(doc);
    const items = Array.from(doc.querySelectorAll('main > ul > li')).map(li => li.textContent.trim());
    assert.deepEqual(items, ['One', 'Two']);
    assert(!logs.some(entry => entry && entry.step === 'UnwrapMalformedListCount'));
  }

  console.log('list-structure-normalization: PASS');
})();
