import assert from 'node:assert';
import { parseMht } from '../src/pipeline/mht.js';

console.log('running charset-fallback unit tests');

const raw = `From: sample
MIME-Version: 1.0
Content-Type: multipart/related; boundary="b"

--b
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

<p>=93Hello=94 =96 world</p>
--b--`;

const noFallback = parseMht(raw, {
  EnableCharsetFallback: false,
  EnableMapping: false
});

assert(noFallback && typeof noFallback.html === 'string', 'expected HTML output without fallback');
assert(
  noFallback.html.includes('\uFFFD') || !noFallback.html.includes('“Hello” – world'),
  'without fallback, misdecoded content should remain'
);
assert(noFallback.charsetFallback === false, 'fallback should not be reported when disabled');

const withFallback = parseMht(raw, {
  EnableCharsetFallback: true,
  EnableMapping: true
});

assert(withFallback && typeof withFallback.html === 'string', 'expected HTML output with fallback');
assert(withFallback.html.includes('“Hello” – world'), 'fallback should decode CP1252 punctuation');
assert(withFallback.charsetFallback === true, 'top-level charsetFallback should be true when applied');
assert(withFallback.charsetUsed === 'windows-1252', 'top-level charsetUsed should report fallback charset');

const htmlPart = (withFallback.parts || []).find((part) => /text\/html/i.test(part.ContentType || ''));
assert(htmlPart, 'expected an HTML part');
assert(htmlPart.CharsetFallbackApplied === true, 'html part should report fallback application');
assert(htmlPart.CharsetUsed === 'windows-1252', 'html part should report fallback charset');
assert(Array.isArray(htmlPart.BodyDecodedMapping), 'expected mapping output when EnableMapping=true');

console.log('charset-fallback.unit: PASS');
