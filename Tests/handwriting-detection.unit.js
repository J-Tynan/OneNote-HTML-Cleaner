import assert from 'assert';
import { JSDOM } from 'jsdom';

if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
  global.NodeFilter = dom.window.NodeFilter;
}

const { runPipeline } = await import('../src/pipeline/pipeline.js');
const { setEnabled } = await import('../src/logging.js');
setEnabled(false);

function parseOutput(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

console.log('running handwriting detection unit tests');

{
  const input = '<!doctype html><html><head><title>x</title></head><body><img src="ink.png" alt="Ink Drawings"></body></html>';
  const { output, logs } = await runPipeline(input, { InjectTailwindCss: false, defaultTitle: 'Doc' });
  const doc = parseOutput(output);
  const img = doc.querySelector('img');
  assert(img, 'image should exist');
  assert.equal(img.getAttribute('data-handwriting'), 'raster', 'raster-only handwriting image should be tagged');
  assert.equal(img.getAttribute('alt'), 'Handwritten notes (raster image)', 'raster-only handwriting image alt should be normalized');

  const handwritingLog = logs.find((entry) => entry && entry.step === 'DetectHandwritingAssets');
  assert(handwritingLog, 'DetectHandwritingAssets log should be emitted');
  assert.equal(handwritingLog.level, 'warn', 'raster-only handwriting should emit warn-level entry');
  assert(handwritingLog.meta && handwritingLog.meta.rasterOnly === true, 'log meta should mark raster-only detection');
  assert(handwritingLog.meta && handwritingLog.meta.annotated >= 1, 'log meta should report annotated handwriting assets');
}

{
  const input = '<!doctype html><html><head><title>x</title></head><body><svg><path d="M0 0"></path></svg><img src="ink.png" alt="Ink Drawings"></body></html>';
  const { output, logs } = await runPipeline(input, { InjectTailwindCss: false, defaultTitle: 'Doc' });
  const doc = parseOutput(output);
  const img = doc.querySelector('img');
  assert(img, 'image should exist');
  assert.equal(img.hasAttribute('data-handwriting'), false, 'mixed vector+raster handwriting should not be forced to raster metadata');
  assert.equal(img.getAttribute('alt'), 'Ink Drawings', 'mixed vector+raster case should preserve existing alt');

  const handwritingLog = logs.find((entry) => entry && entry.step === 'DetectHandwritingAssets');
  assert(handwritingLog, 'DetectHandwritingAssets log should still be emitted for mixed handwriting assets');
  assert.equal(handwritingLog.level, 'info', 'mixed asset detection should be informational');
  assert(handwritingLog.meta && handwritingLog.meta.rasterOnly === false, 'mixed detection should report rasterOnly=false');
}

console.log('handwriting-detection: PASS');
