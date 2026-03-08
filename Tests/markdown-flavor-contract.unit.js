import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
}

const { convertSanitizedHtmlToMarkdown } = await import('../src/convert/markdownCore.js');
const { applyMarkdownFlavor } = await import('../src/convert/markdownFlavors.js');

function readText(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n?/g, '\n');
}

console.log('running markdown flavor contract unit tests');

const fixtureHtml = readText('Tests/fixtures/markdown/flavor-contract.sanitized.html');
const flavors = ['obsidian', 'commonmark', 'gfm', 'markdown-extra'];

for (const flavor of flavors) {
  const output = convertSanitizedHtmlToMarkdown(fixtureHtml, { flavor });

  assert(/## Contract Sample\n\nParagraph after heading\./.test(output), `${flavor}: R1 heading spacing contract should hold`);
  assert(/^\- Alpha$/m.test(output), `${flavor}: R2 unordered list marker should be canonical '-'`);
  assert(/^\s{2}- Nested$/m.test(output), `${flavor}: R2 nested unordered list should preserve indentation`);
  assert(/^1\. First$/m.test(output) && /^2\. Second$/m.test(output) && /^3\. Third$/m.test(output), `${flavor}: R3 ordered list should preserve ordered sequence`);
  if (flavor === 'commonmark') {
    assert(output.includes('- \\[x\\] done') && output.includes('- \\[ \\] queued'), `${flavor}: R4 task markers should be escaped to literal text`);
  } else {
    assert(output.includes('- [x] done') && output.includes('- [ ] queued'), `${flavor}: R4 task list markers should normalize`);
    assert(!output.includes('- [X] done'), `${flavor}: R4 uppercase task marker should be normalized`);
  }
  assert(output.includes('| Name | Score |') && output.includes('| --- | --- |'), `${flavor}: R5 table delimiter canon should hold`);
  assert(output.includes('```') && !output.includes('~~~'), `${flavor}: R6 fenced code should use backticks`);
  assert(output.includes('[Reference link](https://example.org/docs)'), `${flavor}: R7 inline markdown links should be emitted`);
  assert(!/\[\[[^\]]+\]\]/.test(output), `${flavor}: R7 wiki-link syntax should not be emitted`);
  assert(!/<(div|span|table)\b/i.test(output), `${flavor}: R9 raw structural HTML should not appear by default`);

  const deterministic = convertSanitizedHtmlToMarkdown(fixtureHtml, { flavor });
  assert.equal(deterministic, output, `${flavor}: R10 output should be deterministic for same input/options`);
}

{
  const fallback = convertSanitizedHtmlToMarkdown(fixtureHtml, { flavor: 'unknown-flavor' });
  const obsidian = convertSanitizedHtmlToMarkdown(fixtureHtml, { flavor: 'obsidian' });
  assert.equal(fallback, obsidian, 'R10 unknown flavor should fallback to obsidian');
}

{
  const withBreaks = 'Line A\n\n\n\nLine B';
  const extra = applyMarkdownFlavor(withBreaks, { flavor: 'markdown-extra' });
  const obsidian = applyMarkdownFlavor(withBreaks, { flavor: 'obsidian' });
  assert.equal(extra, 'Line A\n\nLine B', 'R8 markdown-extra should collapse 3+ blank lines to two');
  assert.equal(obsidian, withBreaks, 'R8 non-markdown-extra flavors should preserve blank-line runs');
}

console.log('markdown-flavor-contract: PASS');
