import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { ensureMainHeading } from '../src/pipeline/sanitize.js';

function createDoc(html) {
  const dom = new JSDOM(html);
  return dom.window.document;
}

function run(html) {
  const doc = createDoc(html);
  ensureMainHeading(doc, { defaultTitle: 'Doc' });
  return doc;
}

(function main() {
  console.log('running main-heading unit tests');

  // 1. no headings -> default inserted
  {
    const doc = run('<html><body><p>text</p></body></html>');
    const h1s = doc.querySelectorAll('h1');
    assert.equal(h1s.length, 1);
    assert.equal(h1s[0].textContent, 'Doc');
  }

  // 2. single h1 outside main -> moved inside
  {
    const doc = run('<html><body><h1>Title</h1><p>foo</p></body></html>');
    const h1s = doc.querySelectorAll('h1');
    assert.equal(h1s.length, 1);
    assert.equal(doc.querySelector('main').contains(h1s[0]), true);
  }

  // 3. multiple h1s -> extras demoted to h2
  {
    const doc = run('<html><body><h1>A</h1><h1 class="keep" style="color:#ff3030">B</h1><main><h1>C</h1><h1>D</h1></main></body></html>');
    const h1s = doc.querySelectorAll('h1');
    assert.equal(h1s.length, 1);
    assert.equal(h1s[0].textContent, 'A');
    const h2s = doc.querySelectorAll('h2');
    // extras B, C, D should become h2
    assert.equal(h2s.length, 3);
    assert.deepEqual(Array.from(h2s).map(el => el.textContent), ['B', 'C', 'D']);
    assert.equal(h2s[0].getAttribute('class'), 'keep');
    assert.equal(h2s[0].getAttribute('style'), 'color:#ff3030');
  }

  console.log('main-heading: PASS');
})();