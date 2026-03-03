import assert from 'assert';
import { JSDOM } from 'jsdom';

if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
}

const { convertSanitizedHtmlToMarkdown } = await import('../src/convert/markdownCore.js');
const {
  getSupportedMarkdownFlavors,
  normalizeMarkdownFlavor,
  applyMarkdownFlavor
} = await import('../src/convert/markdownFlavors.js');

console.log('running markdown flavor unit tests');

{
  const supported = getSupportedMarkdownFlavors();
  assert.deepEqual(
    supported,
    ['obsidian', 'commonmark', 'gfm', 'markdown-extra'],
    'supported markdown flavors should match planned list'
  );
}

{
  assert.equal(normalizeMarkdownFlavor(undefined), 'obsidian', 'default markdown flavor should be obsidian');
  assert.equal(normalizeMarkdownFlavor('Obsidian'), 'obsidian', 'flavor normalization should be case-insensitive');
  assert.equal(normalizeMarkdownFlavor('CommonMark'), 'commonmark', 'commonmark should normalize');
  assert.equal(normalizeMarkdownFlavor('GFM'), 'gfm', 'gfm should normalize');
  assert.equal(normalizeMarkdownFlavor('Markdown-Extra'), 'markdown-extra', 'markdown-extra should normalize');
  assert.equal(normalizeMarkdownFlavor('unknown-flavor'), 'obsidian', 'unknown flavor should fallback to obsidian');
}

{
  const html = [
    '<!doctype html><html><body>',
    '<h1>Flavor Routing</h1>',
    '<p>Paragraph line.</p>',
    '<ul><li>[ ] Todo item</li><li>[x] Done item</li></ul>',
    '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
    '<pre><code>console.log(1);</code></pre>',
    '</body></html>'
  ].join('');

  const defaultMarkdown = convertSanitizedHtmlToMarkdown(html);
  const obsidianMarkdown = convertSanitizedHtmlToMarkdown(html, { flavor: 'obsidian' });
  assert.equal(defaultMarkdown, obsidianMarkdown, 'default flavor should route to obsidian adapter');

  const unknownFlavorMarkdown = convertSanitizedHtmlToMarkdown(html, { flavor: 'not-real' });
  assert.equal(unknownFlavorMarkdown, obsidianMarkdown, 'unknown flavor should fallback to obsidian output');

  const flavors = ['obsidian', 'commonmark', 'gfm', 'markdown-extra'];
  for (const flavor of flavors) {
    const output = convertSanitizedHtmlToMarkdown(html, { flavor });
    assert.equal(typeof output, 'string', `${flavor} output should be a string`);
    assert(output.includes('# Flavor Routing'), `${flavor} output should include heading`);
    assert(output.includes('| A | B |'), `${flavor} output should include markdown table`);
    assert(output.includes('```'), `${flavor} output should include fenced code block`);
    assert(!/^---\n[\s\S]*\n---\n/.test(output), `${flavor} output should not require frontmatter`);
    assert(!/\[\[[^\]]+\]\]/.test(output), `${flavor} output should not require wikilinks`);
  }
}

{
  const adapted = applyMarkdownFlavor('- [X] Task\n|---|---|\n~~~js\n1\n~~~\n', { flavor: 'gfm' });
  assert(adapted.includes('- [x] Task'), 'task list markers should normalize in flavor adapters');
  assert(adapted.includes('| --- | --- |'), 'table delimiters should normalize in flavor adapters');
  assert(adapted.includes('```js'), 'fenced code block delimiters should normalize in flavor adapters');
}

console.log('markdown-flavors: PASS');
