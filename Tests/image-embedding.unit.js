import assert from 'assert';
import { setupNodeTestEnvironment } from './node-test-helper.js';

// load the module under test
const { embedImagesInHtml, candidatesFor } = await import('../src/pipeline/images.js');

await setupNodeTestEnvironment();

function makeDoc(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

function runSimpleTest(html, map) {
  const doc = makeDoc(html);
  const logs = embedImagesInHtml(doc, map);
  return { output: doc.documentElement.outerHTML, logs };
}

console.log('running image embedding unit tests');

// basic sanity: embedding should match on simple keys without relying on internal helpers
// simple replacement scenario
{
  const data = 'data:image/png;base64,AAA';
  const map = { 'foo.png': data };
  const { output, logs } = runSimpleTest('<img src="foo.png">', map);
  assert(output.includes(data), 'src should be replaced with data URI');
  assert(logs.some(l => l.step === 'embedImages' && l.replacements === 1));
}

// multiple nodes and different attr names
{
  const data1 = 'data:img/1';
  const data2 = 'data:img/2';
  const map = { 'one.png': data1, 'cid:two.png': data2 };
  const { output, logs } = runSimpleTest(
    '<a href="one.png"></a><img src="two.png">',
    map
  );
  assert(output.includes(data1));
  assert(output.includes(data2));
  assert(logs.some(l => l.replacements === 2));
}

// unmatched value should leave markup alone
{
  const { output, logs } = runSimpleTest('<img src="missing.png">', {});
  assert(output.includes('missing.png'));
  assert(logs.length === 0 || logs.every(l => l.step !== 'embedImages'));
  assert(logs.some(l => l.step === 'embedImagesUnresolved' && l.unresolved === 1));
}

// queried relative paths should still match basename entries from the image map
{
  const data = 'data:image/png;base64,QUERY';
  const map = { 'foo.png': data };
  const { output, logs } = runSimpleTest('<img src="images/foo.png?cache=1#frag">', map);
  assert(output.includes(data), 'queried relative image path should be replaced with data URI');
  assert(logs.some(l => l.step === 'embedImages' && l.replacements === 1));
}

// partial success should still surface unresolved resource diagnostics
{
  const data = 'data:image/png;base64,PARTIAL';
  const map = { 'one.png': data };
  const { output, logs } = runSimpleTest('<img src="one.png"><img src="missing-two.png">', map);
  assert(output.includes(data), 'matched image should still be embedded');
  assert(output.includes('missing-two.png'), 'unmatched image should remain unchanged');
  assert(logs.some(l => l.step === 'embedImages' && l.replacements === 1));
  const unresolvedLog = logs.find(l => l.step === 'embedImagesUnresolved');
  assert(unresolvedLog, 'expected unresolved resource warning for partial-success embedding');
  assert.equal(unresolvedLog.unresolved, 1);
  assert.deepEqual(unresolvedLog.samples, ['missing-two.png']);
}

console.log('image-embedding: PASS');
