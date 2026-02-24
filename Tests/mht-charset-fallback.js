// Tests/mht-charset-fallback.js
// Verify that EnableCharsetFallback will retry with CP1252 when utf-8
// decoding produces replacement characters or control codes.

import assert from 'assert';
const { parseMht } = await import('../src/pipeline/mht.js');

// construct a minimal MHT where html part bytes are CP1252 but header says utf-8
const boundary = '----=_NextPart_000_0000';
// 'â' (0xE2) is valid in CP1252 but invalid in utf-8 when treated as single byte
const cp1252bytes = Array.from([0x61,0x20,0xE2,0x20,0x62]).map(b => String.fromCharCode(b)).join('');
// quoted-printable representation of those bytes:
const qp = cp1252bytes.split('').map(ch => {
  const code = ch.charCodeAt(0);
  if (code > 127) return '=' + code.toString(16).padStart(2,'0').toUpperCase();
  return ch;
}).join('');

const mht = `Content-Type: multipart/related; boundary="${boundary}"

--${boundary}
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: quoted-printable

${qp}
--${boundary}--`;

console.log('running charset-fallback unit test');

// no fallback: we expect replacement or controls because 0xE2 alone is invalid utf8
const parsedNoFb = parseMht(mht, { EnableCharsetFallback: false });
assert(parsedNoFb.html.includes('\uFFFD') || /[\u0080-\u009F]/.test(parsedNoFb.html), 'expected utf-8 parse to fail');
console.log('  noFallback result shows replacement/controls', parsedNoFb.html);

// with fallback enabled we should see correct CP1252 conversion: "a â b" becomes "a â b" (same glyph) but with no replacements
const parsedFb = parseMht(mht, { EnableCharsetFallback: true });
assert(parsedFb.html && !parsedFb.html.includes('\uFFFD'), 'fallback output should not contain replacement char');
// top-level field should indicate fallback
assert(parsedFb.charsetFallback === true, 'expected top-level charsetFallback flag');
assert(parsedFb.charsetUsed && parsedFb.charsetUsed.startsWith('windows-1252'), 'expected top-level charsetUsed annotation');
// part-level annotations should also exist
const fbPart = parsedFb.parts.find(p=>/text\/html/i.test(p.ContentType));
assert(fbPart && fbPart.CharsetFallbackApplied === true, 'expected part charset fallback flag');
assert(fbPart.CharsetUsed && fbPart.CharsetUsed.startsWith('windows-1252'));
console.log('  fallback html:', parsedFb.html, 'charsetUsed', parsedFb.charsetUsed);

console.log('mht-charset-fallback: PASS');
