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

console.log('running image alt unit tests');

// non-decorative image without alt should receive fallback alt text
{
  const input = '<!doctype html><html><head><title>x</title></head><body><img src="a.png"></body></html>';
  const { output, logs } = await runPipeline(input, { InjectTailwindCss: false, defaultTitle: 'Doc' });
  const doc = parseOutput(output);
  const img = doc.querySelector('img');
  assert(img, 'image should exist');
  assert.equal(img.getAttribute('alt'), 'Image', 'missing alt should be replaced with fallback');
  assert(logs.some(l => l.step === 'EnsureImageAlt' && l.updated >= 1), 'EnsureImageAlt log should report updates');
}

// image with meaningful alt should be preserved
{
  const input = '<!doctype html><html><head><title>x</title></head><body><img src="a.png" alt="Screenshot of toolbar"></body></html>';
  const { output } = await runPipeline(input, { InjectTailwindCss: false, defaultTitle: 'Doc' });
  const doc = parseOutput(output);
  const img = doc.querySelector('img');
  assert(img, 'image should exist');
  assert.equal(img.getAttribute('alt'), 'Screenshot of toolbar', 'existing alt should remain unchanged');
}

// explicitly decorative images are exempt
{
  const input = '<!doctype html><html><head><title>x</title></head><body><img src="a.png" role="presentation"></body></html>';
  const { output } = await runPipeline(input, { InjectTailwindCss: false, defaultTitle: 'Doc' });
  const doc = parseOutput(output);
  const img = doc.querySelector('img');
  assert(img, 'image should exist');
  assert.equal(img.hasAttribute('alt'), false, 'decorative image should not be forced to have fallback alt');
}

// whitespace-only alt should be normalized for non-decorative images
{
  const input = '<!doctype html><html><head><title>x</title></head><body><img src="a.png" alt="   "></body></html>';
  const { output } = await runPipeline(input, {
    InjectTailwindCss: false,
    defaultTitle: 'Doc',
    ImageAltFallback: 'Image'
  });
  const doc = parseOutput(output);
  const img = doc.querySelector('img');
  assert(img, 'image should exist');
  assert.equal(img.getAttribute('alt'), 'Image', 'blank alt should be replaced for non-decorative image');
}

console.log('image-alt: PASS');
