import assert from 'assert';
import { JSDOM } from 'jsdom';

if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
}

const { convertSanitizedHtmlToMarkdown, assertMarkdownSourceIsSanitizedHtml } = await import('../src/convert/markdownCore.js');

console.log('running markdown core guardrail unit tests');

{
  const html = [
    '<!doctype html>',
    '<html><head><title>Doc</title></head><body>',
    '<h1>Sample Title</h1>',
    '<p>First paragraph.</p>',
    '<ul><li>One</li><li>Two</li></ul>',
    '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
    '</body></html>'
  ].join('');

  const markdown = convertSanitizedHtmlToMarkdown(html);

  assert(markdown.includes('# Sample Title'), 'heading should render as markdown heading');
  assert(markdown.includes('- One'), 'unordered list should render as markdown list');
  assert(/\| A \| B \|/.test(markdown), 'table should render as markdown table');
  assert(!/<(div|span|table)\b/i.test(markdown), 'markdown output must not include prohibited inline HTML tags by default');
}

{
  const rawMhtml = [
    'From: <Saved by Microsoft Internet Explorer 11>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/related; boundary="----=_NextPart_000_0000"'
  ].join('\n');

  assert.throws(
    () => assertMarkdownSourceIsSanitizedHtml(rawMhtml),
    /raw MHTML markers/i,
    'raw MHTML markers should fail canonical markdown source check'
  );
}

{
  const html = '<!doctype html><html><body><h2>Determinism</h2><p>Stable output.</p></body></html>';

  const baseline = convertSanitizedHtmlToMarkdown(html);
  const withUnrelatedOptions = convertSanitizedHtmlToMarkdown(html, {
    ToolbarEnabled: true,
    ExternalizeCssEnabled: true,
    NormalizeDirectionLayout: false,
    randomUiOnlyFlag: 'ignored'
  });

  assert.equal(
    withUnrelatedOptions,
    baseline,
    'markdown output must be byte-stable and independent of unrelated UI options'
  );
}

console.log('markdown-core.guardrails: PASS');
