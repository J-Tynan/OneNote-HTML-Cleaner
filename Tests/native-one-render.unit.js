import assert from 'node:assert/strict';
import { ensureDomParserGlobals, normalizeHtmlForDiff, setupNodeTestEnvironment } from './node-test-helper.js';
import {
  NativeRenderError,
  renderNativePageHtml,
  renderNativePageWithPipeline
} from '../src/importers/one/render.js';

await setupNodeTestEnvironment();

const page = {
  title: 'Plan < Review & Publish',
  blocks: [
    { kind: 'paragraph', text: 'A direct paragraph with <literal> markup.' },
    { kind: 'list', style: 'unordered', items: ['First', 'Second'] },
    { kind: 'list', style: 'ordered', items: ['One', 'Two'] },
    {
      kind: 'table',
      header: ['Name', 'Value'],
      rows: [['Alpha', '1'], ['Beta', '2']]
    },
    {
      kind: 'image',
      source: '_resources/diagram & notes.png',
      alt: 'Architecture diagram',
      caption: 'Directly associated image'
    }
  ]
};

const rawHtml = renderNativePageHtml(page);
assert.equal(normalizeHtmlForDiff(renderNativePageHtml(page)), normalizeHtmlForDiff(rawHtml), 'raw rendering must be deterministic');
assert(!rawHtml.includes('<literal>'), 'page text must be escaped');

ensureDomParserGlobals();
const document = new DOMParser().parseFromString(rawHtml, 'text/html');
assert.equal(document.querySelectorAll('main').length, 1);
assert.equal(document.querySelectorAll('h1').length, 1);
assert.equal(document.querySelector('h1')?.textContent, 'Plan < Review & Publish');
assert.equal(document.querySelector('p')?.textContent, 'A direct paragraph with <literal> markup.');
assert.equal(document.querySelectorAll('ul > li').length, 2);
assert.equal(document.querySelectorAll('ol > li').length, 2);
assert.equal(document.querySelectorAll('table thead th[scope="col"]').length, 2);
assert.equal(document.querySelectorAll('table tbody tr').length, 2);
assert.equal(document.querySelector('img')?.getAttribute('src'), '_resources/diagram & notes.png');
assert.equal(document.querySelector('img')?.getAttribute('alt'), 'Architecture diagram');

const processed = await renderNativePageWithPipeline(page, {
  ToolbarEnabled: false,
  ConvertedPageThemeToggleEnabled: false,
  InjectTailwindCss: false,
  SourceName: 'direct-page.one'
});
const processedDocument = new DOMParser().parseFromString(processed.html, 'text/html');
assert.equal(processedDocument.querySelectorAll('main').length, 1);
assert.equal(processedDocument.querySelectorAll('h1').length, 1);
assert.equal(processedDocument.querySelector('h1')?.textContent, 'Plan < Review & Publish');
assert.equal(processedDocument.querySelectorAll('table tbody tr').length, 2);

assert.throws(
  () => renderNativePageHtml({ title: 'Invalid table', blocks: [{ kind: 'table', rows: [['A'], ['B', 'C']] }] }),
  (error) => error instanceof NativeRenderError && error.code === 'invalid-model'
);
assert.throws(
  () => renderNativePageHtml({ title: 'Invalid image', blocks: [{ kind: 'image', source: '../outside.png' }] }),
  (error) => error instanceof NativeRenderError && error.code === 'invalid-resource-path'
);
assert.throws(
  () => renderNativePageHtml({ title: 'Unknown block', blocks: [{ kind: 'heading', text: 'Guess me' }] }),
  (error) => error instanceof NativeRenderError && error.code === 'unsupported-block'
);

console.log('native-one-render.unit: PASS');