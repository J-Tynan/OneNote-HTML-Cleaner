import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { normalizeDirectionLayoutContainers } from '../src/pipeline/sanitize.js';

function createDoc(html) {
  const dom = new JSDOM(html);
  return dom.window.document;
}

(function main() {
  console.log('running direction-layout-normalization unit tests');

  {
    const doc = createDoc('<html><body><main><div style="direction: ltr"><div style="direction: ltr; margin-top: 0; margin-left: 0; width: 4.475in"><div style="direction: ltr; width: 2.4708in"><p>Sample Title</p></div></div></div></main></body></html>');
    const logs = normalizeDirectionLayoutContainers(doc, {
      unwrapRedundantWrappers: true,
      normalizeTopLevelPageWidths: true
    });

    const main = doc.querySelector('main');
    assert.equal(main.children.length, 1);

    const top = main.children[0];
    assert.equal(top.tagName.toLowerCase(), 'div');
    assert(!/\bwidth\s*:/i.test(String(top.getAttribute('style') || '')));

    const inner = top.querySelector('div[style]');
    assert(inner);
    assert(/\bwidth\s*:\s*2\.4708in/i.test(String(inner.getAttribute('style') || '')));

    assert(logs.some(entry => entry && entry.step === 'NormalizeDirectionLayoutContainers'));
  }

  {
    const doc = createDoc('<html><body><main><div style="direction: ltr; width: 7.5in"><table><tr><td><div style="direction: ltr; width: 2in">inside table</div></td></tr></table></div></main></body></html>');
    normalizeDirectionLayoutContainers(doc, {
      unwrapRedundantWrappers: true,
      normalizeTopLevelPageWidths: true
    });

    const top = doc.querySelector('main > div');
    assert(top);
    assert(!/\bwidth\s*:\s*7\.5in/i.test(String(top.getAttribute('style') || '')));

    const tableDiv = doc.querySelector('td div');
    assert(tableDiv);
    assert(/\bwidth\s*:\s*2in/i.test(String(tableDiv.getAttribute('style') || '')));
  }

  {
    const doc = createDoc('<html><body><main><div style="direction: ltr; margin-top:.2in; margin-left:0; width:7in"><div style="direction: ltr; margin-top:0; margin-left:.2in; width:3in"><h1>Page Title</h1></div><div style="direction: ltr; margin-top:.04in; margin-left:.2in; width:2in"><p>Thursday, April 25, 2024</p><p>4:27 PM</p></div><div style="direction: ltr; margin-top:.1826in; margin-left:0; width:6.5in"><p>Body content</p></div></div></main></body></html>');
    const logs = normalizeDirectionLayoutContainers(doc, {
      unwrapRedundantWrappers: true,
      normalizeTopLevelPageWidths: true,
      standardizeHeaderDatePositions: true
    });

    const rootBlock = doc.querySelector('main > div');
    const titleBlock = doc.querySelector('main > div > div:nth-child(1)');
    const dateBlock = doc.querySelector('main > div > div:nth-child(2)');
    assert(rootBlock);
    assert(titleBlock);
    assert(dateBlock);
    const rootStyle = String(rootBlock.getAttribute('style') || '');
    const titleStyle = String(titleBlock.getAttribute('style') || '');
    const dateStyle = String(dateBlock.getAttribute('style') || '');
    assert(/\bmargin-top\s*:\s*\.2in/i.test(rootStyle));
    assert(/\bmargin-left\s*:\s*\.2in/i.test(rootStyle));
    assert(/\bmargin-top\s*:\s*0\b/i.test(titleStyle));
    assert(/\bmargin-left\s*:\s*0\b/i.test(titleStyle));
    assert(!/\bwidth\s*:/i.test(titleStyle));
    assert(!/\bmargin-left\s*:/i.test(dateStyle));
    assert(!/\bwidth\s*:/i.test(dateStyle));
    assert(!/\bmargin-top\s*:/i.test(dateStyle));

    assert(logs.some(entry => entry && entry.step === 'NormalizeDirectionLayoutContainers' && entry.positionsStandardized >= 2));
  }

  console.log('direction-layout-normalization: PASS');
})();
