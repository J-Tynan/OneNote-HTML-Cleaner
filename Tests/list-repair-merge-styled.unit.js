import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { mergeStyled } from '../src/pipeline/listRepair.js';

function createDoc(html) {
  return new JSDOM(html).window.document;
}

(function main() {
  console.log('running list-repair-merge-styled unit tests');

  {
    const doc = createDoc(
      '<html><body><table><tr><td>' +
      '<ol><li>Parent item<ol><li>Nested item</li></ol></li></ol>' +
      '<ol><li>Second top-level item</li></ol>' +
      '</td></tr></table></body></html>'
    );

    const logs = mergeStyled(doc);
    const topLevelLists = doc.querySelectorAll('td > ol');
    const topLevelItems = Array.from(doc.querySelectorAll('td > ol > li')).map((li) => li.childNodes[0].textContent.trim());
    const nestedItems = Array.from(doc.querySelectorAll('td > ol > li > ol > li')).map((li) => li.textContent.trim());

    assert.equal(topLevelLists.length, 1);
    assert.deepEqual(topLevelItems, ['Parent item', 'Second top-level item']);
    assert.deepEqual(nestedItems, ['Nested item']);
    assert(logs.some((entry) => entry && entry.step === 'mergeStyled' && entry.mergedCount === 1));
  }

  console.log('list-repair-merge-styled: PASS');
})();