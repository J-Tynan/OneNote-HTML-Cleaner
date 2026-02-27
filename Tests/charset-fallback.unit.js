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

const recoveryFailureRaw = `From: sample
MIME-Version: 1.0
Content-Type: multipart/related; boundary="b"

--b
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

<p>Hello=14world=19!</p>
--b--`;

const recoveryFailure = parseMht(recoveryFailureRaw, {
  EnableCharsetFallback: true,
  EnableMapping: false
});

assert(recoveryFailure && typeof recoveryFailure.html === 'string', 'expected HTML output for recovery-failure fixture');
assert(recoveryFailure.charsetFallbackAttempted === true, 'expected fallback attempt to be reported');
assert(recoveryFailure.decodeRecoveryFailed === true, 'expected decode recovery failure when controls remain after fallback attempt');
assert(recoveryFailure.controlCharSanitized === true, 'expected strict fallback sanitization to run');
assert(recoveryFailure.controlSanitizationReason === 'decode-recovery-failed', 'expected decode recovery sanitization reason');
assert(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(recoveryFailure.html), 'recovery-failure output must not contain C0 control chars');

console.log('charset-fallback.unit: PASS');
