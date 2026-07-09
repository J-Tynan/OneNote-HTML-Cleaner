import assert from 'assert';
import { setupNodeTestEnvironment } from './node-test-helper.js';

const { parseMht } = await import('../src/pipeline/mht.js');
const { runPipeline } = await import('../src/pipeline/pipeline.js');

await setupNodeTestEnvironment();

function makePartialEmbeddingMht(imageBase64) {
  return [
    'From: <Saved by OneNote HTML Cleaner>',
    'Subject: partial image embedding test',
    'MIME-Version: 1.0',
    'Content-Type: multipart/related; boundary="BOUNDARY-PARTIAL"',
    '',
    '--BOUNDARY-PARTIAL',
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    '<html><body><img src="cid:present.png"><img src="cid:missing.png"></body></html>',
    '--BOUNDARY-PARTIAL',
    'Content-Type: image/png',
    'Content-Transfer-Encoding: base64',
    'Content-Location: present.png',
    'Content-ID: <present.png>',
    '',
    imageBase64,
    '--BOUNDARY-PARTIAL--',
    ''
  ].join('\r\n');
}

console.log('running mht partial image embedding unit tests');

{
  const raw = makePartialEmbeddingMht(Buffer.from('present-image').toString('base64'));
  const parsed = parseMht(raw, { EnableCharsetFallback: true });

  assert(parsed && typeof parsed === 'object', 'parseMht should return an object');
  assert(parsed.html && parsed.html.includes('cid:present.png'), 'parsed HTML should preserve image references for pipeline embedding');
  assert(parsed.imageMap['cid:present.png'], 'parsed image map should include the present asset');
  assert(!parsed.imageMap['cid:missing.png'], 'parsed image map should not include the missing asset');

  const pipelineResult = await runPipeline(parsed.html, {
    imageMap: parsed.imageMap || {},
    ParseWarnings: parsed.imageDiagnostics || []
  });

  const presentDataUri = parsed.imageMap['cid:present.png'];
  assert(presentDataUri, 'expected present image data URI');
  assert((pipelineResult.output || '').includes(presentDataUri), 'present asset should be embedded in output HTML');
  assert((pipelineResult.output || '').includes('cid:missing.png'), 'missing asset reference should remain unchanged in output HTML');

  const embedLog = (pipelineResult.logs || []).find((entry) => entry && entry.step === 'embedImages');
  assert(embedLog, 'pipeline logs should include successful image embedding count');
  assert.equal(embedLog.replacements, 1, 'expected exactly one embedded image replacement');

  const unresolvedLog = (pipelineResult.logs || []).find((entry) => entry && entry.step === 'embedImagesUnresolved');
  assert(unresolvedLog, 'pipeline logs should include unresolved image warning for missing asset');
  assert.equal((unresolvedLog.level || '').toLowerCase(), 'warn');
  assert.equal(unresolvedLog.unresolved, 1, 'expected one unresolved image reference');
  assert.deepEqual(unresolvedLog.samples, ['cid:missing.png']);
}

console.log('mht-partial-image-embedding: PASS');