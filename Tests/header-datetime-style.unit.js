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

  {
    const doc = createDoc('<html><head><style data-onc-compact-typography="1">.onc-title{margin:0;font-family:"Calibri Light";font-size:20pt;font-weight:400;}.onc-page-title{display:inline-block;padding-right:1in;padding-bottom:0.08em;border-bottom:1px solid #b7b7b7;}.onc-meta{margin:0;font-family:Calibri,Arial,sans-serif;font-size:10pt;}.onc-page-date-tone{color:#666666;}.onc-page-time{color:#666666;margin-left:0.75em;}</style></head><body><main><div><h1 class="converted-page-title onc-title onc-page-title">Title</h1></div><div><p class="converted-page-date onc-meta onc-page-date-tone">Thursday, April 25, 2024<span class="created-time converted-page-time onc-meta onc-page-time">4:27 PM</span></p></div></main></body></html>');
    enforceHeaderDateTimeStyles(doc);
    assert.equal(doc.querySelector('h1').getAttribute('style'), null);
    assert.equal(doc.querySelector('p').getAttribute('style'), null);
    assert.equal(doc.querySelector('span').getAttribute('style'), null);
  }

  {
    const doc = createDoc('<html><body><main><h1 class="onc-title onc-page-title">Title</h1></main></body></html>');
    enforceHeaderDateTimeStyles(doc);
    assert.match(doc.querySelector('h1').getAttribute('style'), /font-size:\s*20pt/);
  }

  console.log('header-datetime-style: PASS');
})();
