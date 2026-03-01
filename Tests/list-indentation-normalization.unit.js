import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { normalizeListIndentation } from '../src/pipeline/listRepair.js';

(function run() {
  console.log('running list-indentation-normalization unit tests');

  const dom = new JSDOM('<main><ol style="mso-list:l0 level1 lfo1;padding-left:40px"><li>First</li></ol><ul style="margin-left:36px"><li>Bullet</li></ul></main>');
  const doc = dom.window.document;

  normalizeListIndentation(doc, {
    listMarginLeft: '0.35em',
    listPaddingLeft: '1.2em',
    normalizeAllListIndent: true
  });

  const ol = doc.querySelector('ol');
  const ul = doc.querySelector('ul');
  assert(ol, 'expected ordered list to exist');
  assert(ul, 'expected unordered list to exist');

  const olStyle = String(ol.getAttribute('style') || '');
  const ulStyle = String(ul.getAttribute('style') || '');

  assert(/padding-left:\s*1\.2em/i.test(olStyle), 'ordered list should include normalized padding-left');
  assert(/padding-inline-start:\s*1\.2em/i.test(olStyle), 'ordered list should include logical padding-inline-start');
  assert(/margin-left:\s*0\.35em/i.test(olStyle), 'ordered list should include small margin-left indentation');

  assert(/padding-left:\s*1\.2em/i.test(ulStyle), 'unordered list should include normalized padding-left');
  assert(/padding-inline-start:\s*1\.2em/i.test(ulStyle), 'unordered list should include logical padding-inline-start');
  assert(/margin-left:\s*0\.35em/i.test(ulStyle), 'unordered list should include small margin-left indentation');

  assert(ol.classList.contains('list-decimal'), 'ordered list should include list-decimal class');
  assert(ol.classList.contains('list-outside'), 'ordered list should include list-outside class');
  assert(ul.classList.contains('list-disc'), 'unordered list should include list-disc class');
  assert(ul.classList.contains('list-outside'), 'unordered list should include list-outside class');

  console.log('list-indentation-normalization: PASS');
})();
