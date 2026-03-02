import assert from 'node:assert';
import { analyzeHtml } from './check-forbidden-artifacts.js';

console.log('running export-independence unit tests');

function hasType(result, type) {
  return result.violations.some((entry) => entry.type === type);
}

{
  const html = '<html><head><script src="https://cdn.example.com/library.js"></script></head><body></body></html>';
  const result = analyzeHtml('external-script.html', html);
  assert(!result.ok, 'External script dependency should fail export-independence check');
  assert(hasType(result, 'external-script-dependency'), 'Expected external-script-dependency violation');
}

{
  const html = '<html><head><link rel="stylesheet" href="https://cdn.example.com/styles.css"></head><body></body></html>';
  const result = analyzeHtml('external-style.html', html);
  assert(!result.ok, 'External stylesheet dependency should fail export-independence check');
  assert(hasType(result, 'external-stylesheet-dependency'), 'Expected external-stylesheet-dependency violation');
}

{
  const html = '<html><head><script src="src/app.js"></script></head><body></body></html>';
  const result = analyzeHtml('app-runtime-script.html', html);
  assert(!result.ok, 'App runtime script dependency should fail export-independence check');
  assert(hasType(result, 'app-runtime-script-dependency'), 'Expected app-runtime-script-dependency violation');
}

{
  const html = '<html><head><style>@import url("https://cdn.example.com/typography.css");</style></head><body></body></html>';
  const result = analyzeHtml('external-css-import.html', html);
  assert(!result.ok, 'External CSS import should fail export-independence check');
  assert(hasType(result, 'external-css-import-dependency'), 'Expected external-css-import-dependency violation');
}

{
  const html = '<html><head><link rel="stylesheet" href="assets/tailwind-output.css"></head><body><main><h1>Doc</h1></main></body></html>';
  const result = analyzeHtml('local-export-asset.html', html);
  assert(result.ok, 'Local packaged stylesheet should be allowed for exported assets');
}

console.log('export-independence: PASS');
