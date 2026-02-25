import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
  global.NodeFilter = dom.window.NodeFilter;
}

const { parseMht } = await import('../src/pipeline/mht.js');
const { runPipeline } = await import('../src/pipeline/pipeline.js');
const { setEnabled } = await import('../src/logging.js');
setEnabled(false);

function normalizeHtml(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/>\s+</g, '><')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function firstDiffIndex(a, b) {
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return -1;
}

console.log('running rerun-equivalence regression test');

const fixtures = fs
  .readdirSync('Tests')
  .filter((name) => /\.mht$/i.test(name))
  .map((name) => path.join('Tests', name));

if (!fixtures.length) {
  console.warn('no .mht fixtures found to test');
  process.exit(0);
}

let failed = false;

for (const fixturePath of fixtures) {
  const rawA = fs.readFileSync(fixturePath, 'latin1');
  const parsedA = parseMht(rawA, { EnableCharsetFallback: true, EnableMapping: true });
  const runA = await runPipeline(parsedA.html || '', {
    EnableCharsetFallback: true,
    imageMap: parsedA.imageMap || {}
  });

  const rawB = fs.readFileSync(fixturePath, 'latin1');
  const parsedB = parseMht(rawB, { EnableCharsetFallback: true, EnableMapping: true });
  const runB = await runPipeline(parsedB.html || '', {
    EnableCharsetFallback: true,
    imageMap: parsedB.imageMap || {}
  });

  const left = normalizeHtml(runA.output);
  const right = normalizeHtml(runB.output);

  if (left !== right) {
    failed = true;
    const idx = firstDiffIndex(left, right);
    const start = Math.max(0, idx - 80);
    const end = idx + 80;
    console.error(`${path.basename(fixturePath)}: FAIL (rerun outputs differ)`);
    console.error(`  first diff index: ${idx}`);
    console.error(`  run1: "${left.slice(start, end).replace(/\n/g, '\\n')}"`);
    console.error(`  run2: "${right.slice(start, end).replace(/\n/g, '\\n')}"`);
  } else {
    console.log(`${path.basename(fixturePath)}: OK`);
  }
}

process.exit(failed ? 1 : 0);
