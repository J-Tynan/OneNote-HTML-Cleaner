import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { ensureMainHeading } from '../src/pipeline/sanitize.js';
import { enforceHeaderDateTimeStyles } from '../src/pipeline/layoutNormalization.js';
import { mergeCreatedDateTimeRow } from '../src/pipeline/dateTimeLayout.js';

function createDoc(html) {
  const dom = new JSDOM(html);
  return dom.window.document;
}

(function main() {
  console.log('running header-datetime-style unit tests');

  {
    const doc = createDoc('<html><head><title>Document</title></head><body><main><div><p style="font-size:20pt; font-family: Calibri Light">Page Title</p></div><div><p>Thursday, April 25, 2024</p><p>4:27 PM</p></div></main></body></html>');
    ensureMainHeading(doc, { defaultTitle: 'Document' });
    mergeCreatedDateTimeRow(doc, { gap: '0.75em' });
    const logs = enforceHeaderDateTimeStyles(doc);

    assert(logs.some(entry => entry && entry.step === 'EnforceHeaderDateTimeStyles'));

    const title = doc.querySelector('main h1');
    assert(title);
    assert(/\bconverted-page-title\b/.test(String(title.getAttribute('class') || '')));
    const titleStyle = String(title.getAttribute('style') || '');
    assert(/font-family\s*:\s*calibri light/i.test(titleStyle));
    assert(/font-size\s*:\s*20pt/i.test(titleStyle));
    assert(/font-weight\s*:\s*400/i.test(titleStyle));
    assert(/display\s*:\s*inline-block/i.test(titleStyle));
    assert(/padding-right\s*:\s*1in/i.test(titleStyle));
    assert(/border-bottom\s*:\s*1px solid #b7b7b7/i.test(titleStyle));

    const dateParagraph = doc.querySelector('main div p');
    assert(dateParagraph);
    assert(/\bconverted-page-date\b/.test(String(dateParagraph.getAttribute('class') || '')));
    const dateStyle = String(dateParagraph.getAttribute('style') || '');
    assert(/font-family\s*:\s*calibri, arial, sans-serif/i.test(dateStyle));
    assert(/font-size\s*:\s*10pt/i.test(dateStyle));
    assert(/color\s*:\s*#666666/i.test(dateStyle));

    const createdTime = doc.querySelector('span.created-time');
    assert(createdTime);
    assert(/\bconverted-page-time\b/.test(String(createdTime.getAttribute('class') || '')));
    const timeStyle = String(createdTime.getAttribute('style') || '');
    assert(/font-family\s*:\s*calibri, arial, sans-serif/i.test(timeStyle));
    assert(/font-size\s*:\s*10pt/i.test(timeStyle));
    assert(/color\s*:\s*#666666/i.test(timeStyle));
  }

  console.log('header-datetime-style: PASS');
})();
