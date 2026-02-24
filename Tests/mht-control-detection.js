// Tests/mht-control-detection.js
// Unit test for control-character detection in parseMht

import assert from 'assert';
const { parseMht } = await import('../src/pipeline/mht.js');

// create a minimal MHT with a single text/html part containing quoted-printable U+0014 and U+0019
const boundary = '----=_NextPart_000_0000';
const htmlContent = 'Hello=14world=19!'; // quoted-printable (0x14 and 0x19)
const mht = `Content-Type: multipart/related; boundary="${boundary}"

--${boundary}
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: quoted-printable

${htmlContent}
--${boundary}--`;

console.log('running control detection unit test');

const parsedNoFb = parseMht(mht, { EnableCharsetFallback: false });
assert(parsedNoFb.controlCharDiagnostics, 'expected diagnostics field');
assert(parsedNoFb.controlCharDiagnostics.count === 2, 'should detect two control characters');
console.log('  diagnosed', parsedNoFb.controlCharDiagnostics.count, 'controls', parsedNoFb.controlCharDiagnostics.samples);

// mapping-enabled run should surface rawTextOffset values that point back into the original MHT
const parsedMapped = parseMht(mht, { EnableCharsetFallback: false, EnableMapping: true });
assert(parsedMapped.controlCharDiagnostics, 'expected diagnostics field with mapping');
parsedMapped.controlCharDiagnostics.samples.forEach(s => {
  assert(typeof s.rawTextOffset === 'number', 'expected rawTextOffset');
  const snippet = mht.slice(s.rawTextOffset, s.rawTextOffset + 3);
  assert(snippet === '=14' || snippet === '=19', 'offset should land on quoted-printable escape: ' + snippet);
});
console.log('  mapping samples', parsedMapped.controlCharDiagnostics.samples);

// with fallback enabled we still expect detection, but may or may not remove controls depending on implementation
const parsedFb = parseMht(mht, { EnableCharsetFallback: true });
assert(parsedFb.controlCharDiagnostics, 'expected diagnostics field with fallback');
console.log('  (fallback) diagnosed', parsedFb.controlCharDiagnostics.count, 'controls');
// top-level charsetFallback flag exists (it may be false if no fallback was needed)
assert(typeof parsedFb.charsetFallback === 'boolean', 'expected charsetFallback boolean field');

// mapping still works post-fallback
const parsedFbMap = parseMht(mht, { EnableCharsetFallback: true, EnableMapping: true });
assert(parsedFbMap.parts.some(p=>Array.isArray(p.BodyDecodedMapping)), 'mapping should survive fallback');

console.log('mht-control-detection: PASS');
