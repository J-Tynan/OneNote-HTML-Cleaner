import assert from 'assert';
import { JSDOM } from 'jsdom';

if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
}

const { createMarkdownIrFromDocument, renderMarkdownFromIr } = await import('../src/convert/markdownIr.js');

console.log('running markdown IR unit tests');

{
  const html = [
    '<!doctype html>',
    '<html><body>',
    '<h1>Doc</h1>',
    '<p>Paragraph text</p>',
    '<ul><li>Alpha<ul><li>Nested</li></ul></li><li>Beta</li></ul>',
    '<pre><code>const x = 1;\nconsole.log(x);</code></pre>',
    '<img src="asset.png" alt="Asset image">',
    '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
    '</body></html>'
  ].join('');

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const ir = createMarkdownIrFromDocument(doc);
  assert.equal(ir.type, 'document', 'IR root should be a document node');
  assert(Array.isArray(ir.blocks), 'IR document should include blocks array');

  const heading = ir.blocks.find((block) => block && block.type === 'heading');
  const paragraph = ir.blocks.find((block) => block && block.type === 'paragraph');
  const list = ir.blocks.find((block) => block && block.type === 'list');
  const code = ir.blocks.find((block) => block && block.type === 'codeBlock');
  const image = ir.blocks.find((block) => block && block.type === 'image');
  const table = ir.blocks.find((block) => block && block.type === 'table');

  assert(heading && heading.level === 1 && heading.text === 'Doc', 'Heading block should be extracted with level/text');
  assert(paragraph && paragraph.text === 'Paragraph text', 'Paragraph block should be extracted');
  assert(list && list.ordered === false, 'List block should be extracted');
  assert(code && /const x = 1;/.test(code.code), 'Code block should be extracted');
  assert(image && image.src === 'asset.png', 'Image block should be extracted');
  assert(table && Array.isArray(table.header) && table.header.length === 2, 'Table block should be extracted with header');

  const markdown = renderMarkdownFromIr(ir);
  assert(markdown.includes('# Doc'), 'Rendered markdown should include heading');
  assert(markdown.includes('- Alpha'), 'Rendered markdown should include list');
  assert(markdown.includes('  - Nested'), 'Rendered markdown should include nested list');
  assert(markdown.includes('```'), 'Rendered markdown should include fenced code block');
  assert(markdown.includes('![Asset image](asset.png)'), 'Rendered markdown should include image syntax');
  assert(/\| A \| B \|/.test(markdown), 'Rendered markdown should include table syntax');
}

{
  const html = [
    '<!doctype html>',
    '<html><body>',
    '<h1>Dental\nAppointment</h1>',
    '<table>',
    '  <tbody>',
    '    <tr><th>Day</th><th>Open</th></tr>',
    '    <tr><td>Monday\n08:30</td><td>17:30</td></tr>',
    '  </tbody>',
    '</table>',
    '</body></html>'
  ].join('');

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const markdown = renderMarkdownFromIr(createMarkdownIrFromDocument(doc));

  assert(markdown.includes('# Dental Appointment'), 'Heading text should collapse embedded newlines to spaces');
  assert(/\| Day \| Open \|/.test(markdown), 'Section-wrapped table rows should be extracted');
  assert(!/\| Monday\n08:30 \|/.test(markdown), 'Table cell newlines should be normalized to spaces');
  assert(/\| Monday 08:30 \| 17:30 \|/.test(markdown), 'Table cell content should remain readable after normalization');
}

{
  const html = [
    '<!doctype html>',
    '<html><body>',
    '<table>',
    '  <tr><td>Class: Test class Files: Topic: Test topic Website: Test website</td></tr>',
    '  <tr><td>Topic: Test topic</td></tr>',
    '</table>',
    '</body></html>'
  ].join('');

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const markdown = renderMarkdownFromIr(createMarkdownIrFromDocument(doc));

  assert(/\| Column 1 \|/.test(markdown), 'Non-header layout tables should remain markdown tables');
  assert(/\| Class: Test class Files: Topic: Test topic Website: Test website \|/.test(markdown), 'Layout row content should be preserved in table cells');
}

{
  const html = [
    '<!doctype html>',
    '<html><body>',
    '<table>',
    '  <tr><td>',
    '    <div>',
    '      <table data-onc-table-layout="two-column">',
    '        <tr><td>Class:</td><td>Test class</td></tr>',
    '        <tr><td>Topic:</td><td>Test topic</td></tr>',
    '      </table>',
    '    </div>',
    '  </td></tr>',
    '</table>',
    '</body></html>'
  ].join('');

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const markdown = renderMarkdownFromIr(createMarkdownIrFromDocument(doc));

  assert(/\| Column 1 \| Column 2 \|/.test(markdown), 'Wrapper tables should unwrap nested multi-column tables');
  assert(/\| Class: \| Test class \|/.test(markdown), 'Unwrapped rows should preserve cue and note columns');
  assert(/\| Topic: \| Test topic \|/.test(markdown), 'Unwrapped nested table data should remain row-based');
}

console.log('markdown-ir: PASS');
