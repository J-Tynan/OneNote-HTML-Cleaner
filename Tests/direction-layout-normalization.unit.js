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
    const firstContentBlock = doc.querySelector('main > div > div:nth-child(3)');
    assert(rootBlock);
    assert(titleBlock);
    assert(dateBlock);
    assert(firstContentBlock);
    const rootStyle = String(rootBlock.getAttribute('style') || '');
    const titleStyle = String(titleBlock.getAttribute('style') || '');
    const dateStyle = String(dateBlock.getAttribute('style') || '');
    const firstContentStyle = String(firstContentBlock.getAttribute('style') || '');
    assert(/\bmargin-top\s*:\s*\.2in/i.test(rootStyle));
    assert(/\bmargin-left\s*:\s*\.2in/i.test(rootStyle));
    assert(/\bmargin-top\s*:\s*0\b/i.test(titleStyle));
    assert(/\bmargin-left\s*:\s*\.2in/i.test(titleStyle));
    assert(!/\bwidth\s*:/i.test(titleStyle));
    assert(/\bmargin-left\s*:\s*\.2in/i.test(dateStyle));
    assert(!/\bwidth\s*:/i.test(dateStyle));
    assert(!/\bmargin-top\s*:/i.test(dateStyle));
    assert(/\bmargin-top\s*:\s*\.1826in/i.test(firstContentStyle));
    assert(/\bmargin-left\s*:\s*\.2in/i.test(firstContentStyle));

    assert(logs.some(entry => entry && entry.step === 'NormalizeDirectionLayoutContainers' && entry.positionsStandardized >= 2));
  }

  {
    const doc = createDoc('<html><body><main><div style="direction: ltr; margin-top:0; margin-left:0"><div style="direction: ltr; margin-top:0; margin-left:.075in"><h1>Sample Page Title</h1></div><div style="direction: ltr; margin-left:.075in"><p>Thursday, April 25, 2024</p><p>4:27 PM</p></div><div style="direction: ltr; margin-top:.4805in; margin-left:.075in; width:7.2597in"><div style="direction: ltr"><table><tr><td style="padding: 2.0pt 3.0pt 2.0pt 3.0pt"><p>Body text</p></td></tr></table></div><p style="margin:0"><img width="16" height="16" src="x.png" alt="icon"></p><p style="margin:0"><img width="16" height="16" src="y.png" alt="icon"></p></div></div></main></body></html>');

    const logs = normalizeDirectionLayoutContainers(doc, {
      unwrapRedundantWrappers: true,
      normalizeTopLevelPageWidths: true,
      standardizeHeaderDatePositions: true
    });

    const iconParagraphs = Array.from(doc.querySelectorAll('main > div > div:nth-child(3) > p')).filter(p => p.querySelector('img'));
    assert.equal(iconParagraphs.length, 2);
    iconParagraphs.forEach(p => {
      const style = String(p.getAttribute('style') || '');
      assert(/\bmargin-left\s*:\s*3(?:\.0+)?pt/i.test(style));
    });

    assert(logs.some(entry => entry && entry.step === 'NormalizeDirectionLayoutContainers' && entry.iconParagraphsAligned === 2));
  }

  {
    const doc = createDoc('<html><body><main><div style="direction: ltr; margin-top:0; margin-left:0"><div style="direction: ltr; margin-top:0; margin-left:.075in"><h1>Sample Page Title</h1></div><div style="direction: ltr; margin-left:.075in"><p>Thursday, April 25, 2024</p><p>4:27 PM</p></div><div style="direction: ltr; margin-top:.2in; margin-left:.075in; width:6in"><p>Body content</p></div></div></main></body></html>');

    normalizeDirectionLayoutContainers(doc, {
      unwrapRedundantWrappers: true,
      normalizeTopLevelPageWidths: true,
      standardizeHeaderDatePositions: true
    });

    const titleBlock = doc.querySelector('main > div > div:nth-child(1)');
    const dateBlock = doc.querySelector('main > div > div:nth-child(2)');
    const firstContentBlock = doc.querySelector('main > div > div:nth-child(3)');
    assert(titleBlock);
    assert(dateBlock);
    assert(firstContentBlock);

    const titleStyle = String(titleBlock.getAttribute('style') || '');
    const dateStyle = String(dateBlock.getAttribute('style') || '');
    const firstContentStyle = String(firstContentBlock.getAttribute('style') || '');

    assert(/\bmargin-left\s*:\s*\.075in/i.test(titleStyle));
    assert(/\bmargin-left\s*:\s*\.075in/i.test(dateStyle));
    assert(/\bmargin-left\s*:\s*0\.125in/i.test(firstContentStyle));
  }

  {
    const doc = createDoc('<html><body><main><div style="direction: ltr; margin-top:0; margin-left:0"><div style="direction: ltr; margin-top:0; margin-left:.2166in"><h1>Test Handwriting</h1></div><div style="direction: ltr; margin-left:.2166in"><p>28 February 2026</p><p>12:25</p></div><div style="direction: ltr; margin-top:.4881in; margin-left:.1951in; width:4.475in"><p>Body content</p></div></div></main></body></html>');

    normalizeDirectionLayoutContainers(doc, {
      unwrapRedundantWrappers: true,
      normalizeTopLevelPageWidths: true,
      standardizeHeaderDatePositions: true
    });

    const titleBlock = doc.querySelector('main > div > div:nth-child(1)');
    const dateBlock = doc.querySelector('main > div > div:nth-child(2)');
    const firstContentBlock = doc.querySelector('main > div > div:nth-child(3)');
    assert(titleBlock);
    assert(dateBlock);
    assert(firstContentBlock);

    const titleStyle = String(titleBlock.getAttribute('style') || '');
    const dateStyle = String(dateBlock.getAttribute('style') || '');
    const firstContentStyle = String(firstContentBlock.getAttribute('style') || '');

    assert(/\bmargin-left\s*:\s*\.2166in/i.test(titleStyle));
    assert(/\bmargin-left\s*:\s*\.2166in/i.test(dateStyle));
    assert(/\bmargin-left\s*:\s*\.1951in/i.test(firstContentStyle));
  }

  {
    const doc = createDoc('<html><body><main><div style="direction: ltr; margin-top:0; margin-left:0; width:4.475in"><div style="direction: ltr; margin-top:0; margin-left:.2166in; width:2.4708in"><h1>Test Handwriting</h1></div><div style="direction: ltr; margin-top:.0409in; margin-left:.2166in; width:1in"><p>28 February 2026</p><p>12:25</p></div><div style="direction: ltr; margin-top:.4881in; margin-left:0; width:4.475in"><img width="537" height="261" src="x.png" alt="Ink Drawings"></div></div></main></body></html>');

    normalizeDirectionLayoutContainers(doc, {
      unwrapRedundantWrappers: true,
      normalizeTopLevelPageWidths: true,
      standardizeHeaderDatePositions: true
    });

    const firstContentBlock = doc.querySelector('main > div > div:nth-child(3)');
    assert(firstContentBlock);
    const firstContentStyle = String(firstContentBlock.getAttribute('style') || '');
    assert(/\bmargin-left\s*:\s*0\.125in/i.test(firstContentStyle));
  }

  {
    const doc = createDoc('<html><body><main><div style="direction: ltr; margin-top:0; margin-left:0; width:4.475in"><div style="direction: ltr; margin-top:0; margin-left:.2166in; width:2.4708in"><h1>Test Handwriting</h1></div><div style="direction: ltr; margin-top:.0409in; margin-left:.2166in; width:1in"><p>28 February 2026</p><p>12:25</p></div><div style="direction: ltr; margin-top:.4881in; margin-left:0; width:4.475in"><img width="537" height="261" src="x.png" alt="Handwritten notes (raster image)" data-handwriting="raster"></div></div></main></body></html>');

    normalizeDirectionLayoutContainers(doc, {
      unwrapRedundantWrappers: true,
      normalizeTopLevelPageWidths: true,
      standardizeHeaderDatePositions: true
    });

    const firstContentBlock = doc.querySelector('main > div > div:nth-child(3)');
    assert(firstContentBlock);
    const firstContentStyle = String(firstContentBlock.getAttribute('style') || '');
    assert(/\bmargin-left\s*:\s*0?\.075in/i.test(firstContentStyle));
  }

  {
    const doc = createDoc('<html><body><main><div style="direction: ltr; margin-top:0; margin-left:0; width:4.475in"><div style="direction: ltr; margin-top:0; margin-left:.2166in; width:2.4708in"><h1>Test Handwriting</h1></div><div style="direction: ltr; margin-top:.0409in; margin-left:.2166in; width:1in"><p>28 February 2026</p><p>12:25</p></div><div style="direction: ltr; margin-top:.4881in; margin-left:0; width:4.475in"><img width="537" height="261" src="x.png" alt="Handwritten notes (raster image)" data-handwriting="raster"></div><div style="direction: ltr; margin-top: 11.7513in; margin-left: .1951in; width: .7923in"><p>&lt;&lt;Test another.md&gt;&gt;</p></div></div></main></body></html>');

    const logs = normalizeDirectionLayoutContainers(doc, {
      unwrapRedundantWrappers: true,
      normalizeTopLevelPageWidths: true,
      standardizeHeaderDatePositions: true
    });

    const followOnBlock = doc.querySelector('main > div > div:nth-child(4)');
    assert(followOnBlock);
    const followOnStyle = String(followOnBlock.getAttribute('style') || '');
    assert(/\bmargin-left\s*:\s*0?\.075in/i.test(followOnStyle));
    assert(logs.some(entry => entry && entry.step === 'NormalizeDirectionLayoutContainers' && entry.handwritingContentMarginsStandardized >= 1));
  }

  console.log('direction-layout-normalization: PASS');
})();
