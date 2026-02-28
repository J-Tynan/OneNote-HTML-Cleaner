import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { mergeCreatedDateTimeRow } from '../src/pipeline/dateTimeLayout.js';

function createDoc(html) {
  const dom = new JSDOM(html);
  return dom.window.document;
}

(function main() {
  console.log('running created-datetime-row unit tests');

  {
    const doc = createDoc('<html><body><div><p>31 March 2025</p><p>15:30</p></div></body></html>');
    const logs = mergeCreatedDateTimeRow(doc, { gap: '0.75em' });
    assert.equal(logs.length, 1);
    const p = doc.querySelector('div > p');
    assert(p);
    const span = p.querySelector('span.created-time');
    assert(span);
    assert.equal(span.textContent, '15:30');
    assert.equal(doc.querySelectorAll('div > p').length, 1);
  }

  {
    const doc = createDoc('<html><body><div><p>Thursday, April 25, 2024</p><p>4:27 PM</p></div></body></html>');
    mergeCreatedDateTimeRow(doc, { gap: '0.75em' });
    const p = doc.querySelector('div > p');
    assert(p);
    const span = p.querySelector('span.created-time');
    assert(span);
    assert.equal(span.textContent, '4:27 PM');
    assert.equal(doc.querySelectorAll('div > p').length, 1);
  }

  console.log('created-datetime-row: PASS');
})();
