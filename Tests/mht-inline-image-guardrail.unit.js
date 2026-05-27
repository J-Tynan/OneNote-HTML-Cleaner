import assert from 'assert';
import { setupNodeTestEnvironment } from './node-test-helper.js';

const { parseMht } = await import('../src/pipeline/mht.js');
const { runPipeline } = await import('../src/pipeline/pipeline.js');

await setupNodeTestEnvironment();

function makeMultipartMht(imageBase64) {
  return [
    'From: <Saved by OneNote HTML Cleaner>',
    'Subject: inline image guardrail test',
    'MIME-Version: 1.0',
    'Content-Type: multipart/related; boundary="BOUNDARY-TEST"',
    '',
    '--BOUNDARY-TEST',
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    '<html><body><img src="cid:big.png"></body></html>',
    '--BOUNDARY-TEST',
    'Content-Type: image/png',
    'Content-Transfer-Encoding: base64',
    'Content-Location: big.png',
    'Content-ID: <big.png>',
    '',
    imageBase64,
    '--BOUNDARY-TEST--',
    ''
  ].join('\r\n');
}

console.log('running mht inline-image guardrail unit tests');

{
  const oversizedB64 = Buffer.alloc(64, 1).toString('base64');
  const raw = makeMultipartMht(oversizedB64);
  const parsed = parseMht(raw, {
    InlineImageMaxBytes: 32,
    OversizedInlineImageBehavior: 'warn-skip'
  });

  assert(parsed && typeof parsed === 'object', 'parseMht should return an object');
  assert(parsed.html && parsed.html.includes('<img'), 'parsed HTML should be present');
  assert(Array.isArray(parsed.imageDiagnostics), 'imageDiagnostics should be present');
  assert(parsed.imageDiagnostics.length === 1, 'expected one guardrail diagnostic for oversized asset');
  assert(Object.keys(parsed.imageMap || {}).length === 0, 'oversized asset should be skipped from image map');

  const pipelineResult = await runPipeline(parsed.html, {
    imageMap: parsed.imageMap || {},
    ParseWarnings: parsed.imageDiagnostics
  });
  const guardrailLog = (pipelineResult.logs || []).find((entry) => entry && entry.step === 'inlineImageGuardrail');
  assert(guardrailLog, 'pipeline logs should include inlineImageGuardrail warning');
  assert((guardrailLog.level || '').toLowerCase() === 'warn', 'guardrail warning should be warn level');
}

{
  const oversizedB64 = Buffer.alloc(64, 1).toString('base64');
  const raw = makeMultipartMht(oversizedB64);
  const parsed = parseMht(raw, {
    InlineImageMaxBytes: 32,
    OversizedInlineImageBehavior: 'warn-only'
  });

  assert(Array.isArray(parsed.imageDiagnostics) && parsed.imageDiagnostics.length === 1, 'warn-only still emits warning diagnostic');
  assert(Object.keys(parsed.imageMap || {}).length > 0, 'warn-only should preserve oversized asset in image map');
}

console.log('mht-inline-image-guardrail: PASS');
