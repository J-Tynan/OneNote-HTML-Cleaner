import assert from 'node:assert';
import { ensureDomParserGlobals } from './node-test-helper.js';
import * as sanitize from '../src/pipeline/sanitize.js';

ensureDomParserGlobals();

function makeDoc(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

console.log('running contrast-color-normalization unit tests');

{
  const doc = makeDoc('<p style="color: #969696; font-size: 9pt;">x</p><p style="color: gray">y</p><p style="color: #ff3030">z</p>');
  const logs = sanitize.normalizeAccessibleTextContrast(doc);
  const styles = Array.from(doc.querySelectorAll('p')).map((el) => el.getAttribute('style') || '');
  assert(styles[0].includes('color: #666666'));
  assert(styles[1].includes('color: #666666'));
  assert(styles[2].includes('color: #c00000'));
  assert(logs.some((entry) => entry.step === 'NormalizeAccessibleTextContrast' && entry.updatedColors === 3));
}

{
  const doc = makeDoc('<p style="color: #767676">ok</p><p style="font-size: 11pt">no-color</p>');
  const before = doc.documentElement.outerHTML;
  const logs = sanitize.normalizeAccessibleTextContrast(doc);
  const after = doc.documentElement.outerHTML;
  assert.strictEqual(after, before);
  assert.strictEqual(logs.length, 0);
}

console.log('contrast-color-normalization: PASS');
