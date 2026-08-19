import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { ensureDomParserGlobals } from './node-test-helper.js';
import * as sanitize from '../src/pipeline/sanitize.js';

ensureDomParserGlobals();

function sanitizeHtml(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  sanitize.removeOneNoteMeta(doc);
  sanitize.removeOfficeArtifacts(doc);
  sanitize.normalizeTableCellParagraphMargins(doc);
  sanitize.sanitizeImageAttributes(doc);
  sanitize.removeNbsp(doc);
  return doc.documentElement.outerHTML;
}

function normalizeFooterGap(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  sanitize.normalizeContentBlankLineSpacers(doc);
  sanitize.ensureCreatedWithOneNoteFooterGap(doc);
  return doc.documentElement.outerHTML;
}

function normalizeContentBlankLineSpacersHtml(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  sanitize.normalizeContentBlankLineSpacers(doc);
  return doc.documentElement.outerHTML;
}

function normalizeLeadingTagParagraphIndentHtml(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  sanitize.normalizeLeadingTagParagraphIndent(doc);
  return doc.documentElement.outerHTML;
}

(function main() {
  console.log('running OneNote sanitizer unit tests');
  const cases = [
    {
      name: 'basic xmlns and links',
      input: '<html xmlns:o="urn:foo"><head><link rel="Main-File" href=x></head><body>Hello</body></html>',
      forbid: ['xmlns:o', 'Main-File'],
    },
    {
      name: 'mso attributes removal',
      input: '<p class="MsoNormal" style="mso-style-name:Normal;font-size:12pt">text</p>',
      forbid: ['MsoNormal', 'mso-style-name'],
    },
    {
      name: 'spacerun collapse',
      input: '<span style="mso-spacerun:yes"> </span>',
      forbid: ['mso-spacerun'],
      expectContains: [' '],
    },
    {
      name: 'bullet span flatten',
      input: '<span>•</span>',
      expectContains: ['•'],
    },
    {
      name: 'list style cleaning',
      input: '<ul style="padding-left:40px;mso-list:l0 level1 lfo1"><li>one</li></ul>',
      forbid: ['mso-list'],
    },
    {
      name: 'table cell paragraph margin normalization',
      input: '<table><tr><td><p><code style="margin:0in">Header 1</code></p></td><td><p style="margin:0in">Row 1</p></td></tr></table>',
      expectContains: ['<p style="margin: 0"><code style="margin:0in">Header 1</code></p>', '<p style="margin:0in">Row 1</p>'],
    }
  ];

  let failed = false;
  for (const c of cases) {
    const out = sanitizeHtml(c.input);
    if (c.forbid) {
      for (const token of c.forbid) {
        if (out.includes(token)) {
          console.error(`${c.name}: output still contains ${token}`);
          failed = true;
        }
      }
    }
    if (c.expectContains) {
      for (const token of c.expectContains) {
        if (!out.includes(token)) {
          console.error(`${c.name}: output missing expected ${token}`);
          failed = true;
        }
      }
    }
    if (!failed) console.log(`${c.name}: OK`);
  }

  const footerGapInput = `
    <html><body><main>
      <div>
        <p><img src="data:image/png;base64,AAAA" width="16" height="16" alt="GemIcon"></p>
      </div>
      <div>
        <p>Created with OneNote.</p>
      </div>
    </main></body></html>
  `;
  const footerGapOutput = normalizeFooterGap(footerGapInput);
  if (!footerGapOutput.includes('data:image/png;base64,AAAA')) {
    console.error('footer gap normalization should not remove image-only paragraphs before footer');
    failed = true;
  } else if (!/Created with OneNote\.<\/p>/.test(footerGapOutput) || !/margin-left:\s*8px/i.test(footerGapOutput)) {
    console.error('footer gap normalization should add a small left inset to the Created with OneNote footer');
    failed = true;
  } else if (!failed) {
    console.log('footer gap icon preservation: OK');
  }

  const detailCellSpacerInput = `
    <html><body><main>
      <table><tr>
        <td>Cues</td>
        <td>Notes</td>
        <td>Extras</td>
      </tr><tr>
        <td style="font-size:11.0pt">Label</td>
        <td>
          <p style="margin:0;font-family:Calibri;font-size:11.0pt">First line</p>
          <p style="margin:0;font-family:Calibri;font-size:11.0pt"> </p>
          <p style="margin:0;font-family:Calibri;font-size:11.0pt">Second line</p>
        </td>
        <td>
          <p style="margin:0;font-size:1pt"> </p>
        </td>
      </tr></table>
    </main></body></html>
  `;
  const detailCellSpacerOutput = normalizeContentBlankLineSpacersHtml(detailCellSpacerInput);
  if (!detailCellSpacerOutput.includes('class="converted-content-spacer"') || !detailCellSpacerOutput.includes('<br>')) {
    console.error('content blank lines inside semantic detail columns should normalize to explicit spacer blocks before table annotation');
    failed = true;
  } else if (detailCellSpacerOutput.includes('<td>\n          <p style="margin:0;font-size:1pt" class="converted-content-spacer"><br></p>')) {
    console.error('tiny filler paragraphs in non-semantic table cells should not normalize to content spacers');
    failed = true;
  } else if (!failed) {
    console.log('detail cell blank-line spacer normalization: OK');
  }

  const leadingTagIndentInput = `
    <html><body><main>
      <p style="margin:0;font-family:Calibri;font-size:11.0pt">Regular text</p>
      <p style="color:#000000;margin:0;text-indent:-.1666in;font-family:Calibri;font-size:11.0pt"><img src="data:image/png;base64,AAAA" width="16" height="16" alt="Idea"> Some normal text with a tag.</p>
    </main></body></html>
  `;
  const leadingTagIndentOutput = normalizeLeadingTagParagraphIndentHtml(leadingTagIndentInput);
  if (!leadingTagIndentOutput.includes('text-indent: calc(-.1666in - 0.23em)')) {
    console.error('leading tag paragraphs should get the normalized hanging indent override');
    failed = true;
  } else if (!failed) {
    console.log('leading tag paragraph indent normalization: OK');
  }

  if (failed) {
    console.error('sanitizer-onenote: FAIL');
    process.exit(1);
  }
  console.log('sanitizer-onenote: PASS');
})();
