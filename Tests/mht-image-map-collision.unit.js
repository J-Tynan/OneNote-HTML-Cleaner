import assert from 'assert';
import { setupNodeTestEnvironment } from './node-test-helper.js';

const { parseMht } = await import('../src/pipeline/mht.js');
const { runPipeline } = await import('../src/pipeline/pipeline.js');

await setupNodeTestEnvironment();

function makeCollisionMht(firstBase64, secondBase64) {
  return [
    'From: <Saved by OneNote HTML Cleaner>',
    'Subject: image map collision test',
    'MIME-Version: 1.0',
    'Content-Type: multipart/related; boundary="BOUNDARY-COLLISION"',
    '',
    '--BOUNDARY-COLLISION',
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    '<html><body><img src="image001.png"><img src="folder-two/image001.png"></body></html>',
    '--BOUNDARY-COLLISION',
    'Content-Type: image/png',
    'Content-Transfer-Encoding: base64',
    'Content-Location: folder-one/image001.png',
    '',
    firstBase64,
    '--BOUNDARY-COLLISION',
    'Content-Type: image/png',
    'Content-Transfer-Encoding: base64',
    'Content-Location: folder-two/image001.png',
    '',
    secondBase64,
    '--BOUNDARY-COLLISION--',
    ''
  ].join('\r\n');
}

console.log('running mht image map collision unit tests');

{
  const firstBase64 = Buffer.from('first-image').toString('base64');
  const secondBase64 = Buffer.from('second-image').toString('base64');
  const raw = makeCollisionMht(firstBase64, secondBase64);
  const parsed = parseMht(raw, { EnableCharsetFallback: true });

  assert(parsed && typeof parsed === 'object', 'parseMht should return an object');
  assert(Array.isArray(parsed.imageDiagnostics), 'imageDiagnostics should be present');
  const collision = parsed.imageDiagnostics.find((entry) => entry && entry.step === 'imageMapCollision');
  assert(collision, 'expected image-map collision warning when two assets share the same derived basename key');
  assert.equal((collision.level || '').toLowerCase(), 'warn');
  assert.equal(collision.meta.key, 'image001.png');

  const firstDataUri = parsed.imageMap['folder-one/image001.png'];
  const secondDataUri = parsed.imageMap['folder-two/image001.png'];
  assert(firstDataUri && secondDataUri, 'full content-location keys should both remain addressable');
  assert.notEqual(firstDataUri, secondDataUri, 'distinct content locations should keep distinct asset payloads');
  assert.equal(parsed.imageMap['image001.png'], firstDataUri, 'ambiguous basename key should preserve the first mapping deterministically');

  const pipelineResult = await runPipeline(parsed.html, {
    imageMap: parsed.imageMap || {},
    ParseWarnings: parsed.imageDiagnostics
  });

  const collisionLog = (pipelineResult.logs || []).find((entry) => entry && entry.step === 'imageMapCollision');
  assert(collisionLog, 'pipeline logs should include imageMapCollision warning');
  assert((pipelineResult.output || '').includes(firstDataUri), 'basename image reference should resolve to the preserved first mapping');
  assert((pipelineResult.output || '').includes(secondDataUri), 'full-path image reference should resolve to the exact second asset mapping');
}

console.log('mht-image-map-collision: PASS');