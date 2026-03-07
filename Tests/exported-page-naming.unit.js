import assert from 'node:assert';
import {
  normalizeExportStem,
  extractReadableTitle,
  buildPreferredExportStem,
  buildUniqueFilename
} from '../src/export-filenames.js';

console.log('running exported page naming unit tests');

{
  const stem = normalizeExportStem('  Project Plan: Q2 / 2026  ');
  assert.equal(stem, 'project-plan-q2-2026', 'expected normalized slug stem');
}

{
  const stem = normalizeExportStem('CON');
  assert.equal(stem, 'con-page', 'expected Windows reserved names to be remapped');
}

{
  const guidLike = '2f3e9ec3-0dfd-4f22-a16f-8ca17d4f2f0d';
  const html = '<html><head><title>Ignored Title</title></head><body><main><h1>Weekly Notes</h1></main></body></html>';
  const stem = buildPreferredExportStem({ sourceName: `${guidLike}.mht`, content: html, format: 'html' });
  assert.equal(stem, 'weekly-notes', 'expected h1 title to replace GUID-like source stems');
}

{
  const html = '<html><head><title>Fallback Title</title></head><body><main><p>Body</p></main></body></html>';
  const stem = buildPreferredExportStem({ sourceName: 'My Export.mht', content: html, format: 'html' });
  assert.equal(stem, 'my-export', 'expected readable source stem when source name is already meaningful');
}

{
  const markdown = '# Sprint Retrospective\n\nBody text';
  const title = extractReadableTitle(markdown, 'markdown');
  assert.equal(title, 'Sprint Retrospective', 'expected markdown heading extraction');
}

{
  const used = new Set();
  const first = buildUniqueFilename('weekly-notes', 'html', used);
  const second = buildUniqueFilename('weekly-notes', 'html', used);
  const third = buildUniqueFilename('weekly-notes', 'html', used);
  assert.equal(first, 'weekly-notes.html');
  assert.equal(second, 'weekly-notes-2.html');
  assert.equal(third, 'weekly-notes-3.html');
}

{
  const used = new Set();
  const cssOne = buildUniqueFilename('weekly-notes', 'css', used);
  const cssTwo = buildUniqueFilename('weekly-notes', 'css', used);
  assert.equal(cssOne, 'weekly-notes.css');
  assert.equal(cssTwo, 'weekly-notes-2.css');
}

console.log('exported-page-naming: PASS');
