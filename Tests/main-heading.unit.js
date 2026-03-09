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

      // 4. OneNote-style large title paragraph should be promoted (no fallback "Document" h1)
      {
        const doc = run('<html><head><title>Document</title></head><body><div><p style="margin:0;font-family:Calibri;font-size:20.0pt">Test Handwriting</p><p style="margin:0;font-size:10.0pt;color:#767676">28 February 2026</p></div></body></html>');
        const h1s = doc.querySelectorAll('h1');
        assert.equal(h1s.length, 1);
        assert.equal(h1s[0].textContent.trim(), 'Test Handwriting');
        assert.equal(doc.querySelector('title').textContent, 'Test Handwriting');
        assert.equal(doc.querySelectorAll('h1').length, 1);
      }

      // 5. OneNote page-title paragraph should win over early table-header h1 (e.g. "Cues")
      {
        const doc = run('<html><head><title>Document</title></head><body><main><div><p style="margin:0;font-family:Calibri;font-size:20.0pt">Sample Note Title</p></div><table><tr><td><h1>Cues</h1></td></tr></table></main></body></html>');
        const h1s = doc.querySelectorAll('h1');
        assert.equal(h1s.length, 1);
        assert.equal(h1s[0].textContent.trim(), 'Sample Note Title');
        assert.equal(doc.querySelector('title').textContent, 'Sample Note Title');
        const h2s = doc.querySelectorAll('h2');
        assert.equal(h2s.length, 1);
        assert.equal(h2s[0].textContent.trim(), 'Cues');
      }

      // 6. once a converted page title exists, later large paragraphs should not be re-promoted
      {
        const doc = run('<html><head><title>Resolved</title></head><body><main><h1 class="converted-page-title" style="margin:0">Resolved</h1><p class="converted-content-spacer"><br></p><p style="margin:0;font-family:&quot;Calibri Light&quot;;font-size:20.0pt">Section Heading</p></main></body></html>');
        const h1s = doc.querySelectorAll('h1');
        assert.equal(h1s.length, 1);
        assert.equal(h1s[0].textContent.trim(), 'Resolved');
        assert.equal(doc.querySelectorAll('h2').length, 0);
        const paragraphs = doc.querySelectorAll('p');
        assert.equal(paragraphs.length, 2);
        assert.equal(paragraphs[1].textContent.trim(), 'Section Heading');
      }

      console.log('main-heading: PASS');
    })();