import assert from 'node:assert';
import { buildExportFileName, derivePreferredExportStem } from '../src/ui-downloads.js';

(function main() {
  console.log('running export-file-naming unit tests');

  assert.equal(
    buildExportFileName({
      entryName: '123e4567-e89b-12d3-a456-426614174000.mht',
      outputFormat: 'html',
      outputContent: '<!doctype html><html><head><title>Quarterly Notes</title></head><body><main><h1>Quarterly Notes</h1></main></body></html>'
    }),
    'Quarterly Notes.html'
  );

  assert.equal(
    buildExportFileName({
      entryName: 'Meeting Notes.mht',
      outputFormat: 'html',
      outputContent: '<!doctype html><html><head><title>Document</title></head><body><main><h1>Document</h1></main></body></html>'
    }),
    'Meeting Notes.html'
  );

  assert.equal(
    buildExportFileName({
      entryName: '550e8400-e29b-41d4-a716-446655440000.mht',
      outputFormat: 'html',
      outputContent: '<!doctype html><html><head><title>Document</title></head><body><main><h1>Document</h1></main></body></html>'
    }),
    'converted-page.html'
  );

  assert.equal(
    buildExportFileName({
      entryName: '4f0d2b2e-6d5a-4c80-aec8-2dc4f5cdab31.mht',
      outputFormat: 'html',
      outputContent: '<!doctype html><html><head><title>Quarterly Notes</title></head><body></body></html>',
      takenNames: new Set(['Quarterly Notes.html'])
    }),
    'Quarterly Notes (2).html'
  );

  assert.equal(
    buildExportFileName({
      entryName: '9d0b3ca8-e17f-47b5-b96c-3ab4b48d2e8f.mht',
      outputFormat: 'markdown',
      outputContent: '# Release Plan\n\nBody text'
    }),
    'Release Plan.md'
  );

  assert.equal(
    derivePreferredExportStem({
      entryName: 'guid-name.mht',
      outputFormat: 'html',
      outputContent: '<!doctype html><html><head><title>Roadmap: Q2 / Ops?</title></head><body></body></html>'
    }),
    'Roadmap Q2 Ops'
  );

  console.log('export-file-naming: PASS');
})();