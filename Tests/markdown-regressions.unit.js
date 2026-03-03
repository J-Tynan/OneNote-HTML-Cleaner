import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
}

const { convertSanitizedHtmlToMarkdown } = await import('../src/convert/markdownCore.js');

function readText(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n?/g, '\n');
}

function hasMarkdownRuntimeDependency(markdown) {
  const source = String(markdown || '');
  return /<script\b/i.test(source)
    || /<link\b/i.test(source)
    || /@import\s+url\(/i.test(source)
    || /node_modules\//i.test(source)
    || /src\/(app|worker|ui)\.js/i.test(source);
}

console.log('running markdown regression unit tests');

{
  const fixtures = [
    {
      name: 'representative',
      htmlPath: 'Tests/fixtures/markdown/representative.sanitized.html',
      expectedPath: 'Tests/expected/markdown/representative.md'
    },
    {
      name: 'positioned-reading-order',
      htmlPath: 'Tests/fixtures/markdown/positioned-reading-order.sanitized.html',
      expectedPath: 'Tests/expected/markdown/positioned-reading-order.md'
    }
  ];

  for (const fixture of fixtures) {
    const fixtureHtml = readText(fixture.htmlPath);
    const expectedMarkdown = readText(fixture.expectedPath).trim();
    const actualMarkdown = convertSanitizedHtmlToMarkdown(fixtureHtml);

    assert.equal(
      actualMarkdown,
      expectedMarkdown,
      `${fixture.name} markdown fixture output should remain byte-stable`
    );

    assert.equal(
      hasMarkdownRuntimeDependency(actualMarkdown),
      false,
      `${fixture.name} markdown output must not include CSS/JS/runtime dependencies`
    );
  }
}

console.log('markdown-regressions: PASS');
