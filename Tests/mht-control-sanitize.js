// Tests/mht-control-sanitize.js
// Verify that EnableControlSanitization removes control characters from html

import assert from 'assert';
const { parseMht } = await import('../src/pipeline/mht.js');

// reuse minimal mht from detection test
const boundary = '----=_NextPart_000_0000';
const htmlContent = 'Hello=14world=19!';
const mht = `Content-Type: multipart/related; boundary="${boundary}"

--${boundary}
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: quoted-printable

${htmlContent}
--${boundary}--`;

console.log('running control sanitization unit test');

const parsed = parseMht(mht, { EnableControlSanitization: true });
assert(parsed.html && parsed.html.indexOf('\u0014') === -1 && parsed.html.indexOf('\u0019') === -1,
    'sanitized html must not contain control chars');
assert(parsed.controlCharSanitized, 'sanitization flag should be true');

// also ensure mapping option can be combined with sanitization
const parsedMap = parseMht(mht, { EnableControlSanitization: true, EnableMapping: true });
assert(parsedMap.html && parsedMap.html.indexOf('\u0014') === -1 && parsedMap.html.indexOf('\u0019') === -1);
assert(parsedMap.controlCharSanitized, 'sanitization flag should be true (mapping run)');
assert(parsedMap.parts && parsedMap.parts.some(p=>Array.isArray(p.BodyDecodedMapping)), 'mapping should be present on at least one part when requested');

console.log('mht-control-sanitize: PASS');
