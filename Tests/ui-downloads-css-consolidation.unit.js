import assert from 'node:assert';
import { collectStylesheetHrefs, consolidateCssRules, inlineStylesheetLinks } from '../src/ui-downloads.js';

console.log('running ui-downloads CSS consolidation unit tests');

{
  const input = [
    '.extcss-a { margin: 0; color: #111; }',
    '.extcss-b { margin: 0; color: #111; }',
    '.extcss-a { margin: 0; color: #111; }',
    '.converted-page-spacer{margin:0;line-height:0.95;font-size:1em;}',
    '.converted-page-spacer { margin: 0; line-height: 0.95; font-size: 1em; }'
  ].join('\n\n');

  const output = consolidateCssRules(input);

  const extcssAMatches = output.match(/\.extcss-a\s*\{[^}]*\}/g) || [];
  const extcssBMatches = output.match(/\.extcss-b\s*\{[^}]*\}/g) || [];
  const spacerMatches = output.match(/\.converted-page-spacer\s*\{[^}]*\}/g) || [];

  assert.equal(extcssAMatches.length, 1, 'expected duplicate .extcss-a rule to be deduped');
  assert.equal(extcssBMatches.length, 1, 'expected distinct selector to be retained');
  assert.equal(spacerMatches.length, 1, 'expected duplicate spacer rule to be deduped');
}

{
  const passthrough = '/* comment only */';
  const output = consolidateCssRules(passthrough);
  assert.equal(output, passthrough, 'non-rule css should pass through unchanged');
}

{
  const html = '<html><head><link rel="stylesheet" href="assets/tailwind-output.css"><link rel="preload" href="skip.css"><link href="assets/tailwind-output.css" rel="stylesheet"></head><body></body></html>';
  const hrefs = collectStylesheetHrefs(html);
  assert.deepEqual(hrefs, ['assets/tailwind-output.css'], 'expected stylesheet href collection to preserve distinct stylesheet links only');
}

{
  const html = '<html><head><meta charset="utf-8"><link rel="stylesheet" href="assets/tailwind-output.css"></head><body><main>Body</main></body></html>';
  const output = inlineStylesheetLinks(html, {
    'assets/tailwind-output.css': 'body { color: red; }'
  });
  assert(output.includes('data-onc-inline-stylesheet="assets/tailwind-output.css"'), 'expected bundled stylesheet link to be replaced with inline style');
  assert(output.includes('body { color: red; }'), 'expected inline stylesheet content to be preserved');
  assert(!output.includes('<link rel="stylesheet" href="assets/tailwind-output.css">'), 'expected original stylesheet link to be removed after inlining');
}

console.log('ui-downloads-css-consolidation: PASS');
