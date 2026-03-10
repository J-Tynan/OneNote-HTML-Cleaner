import assert from 'node:assert';
import { consolidateCssRules } from '../src/ui-downloads.js';

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

console.log('ui-downloads-css-consolidation: PASS');
