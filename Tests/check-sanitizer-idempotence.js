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

console.log('running sanitizer idempotence regression test');

const fixtures = fs
  .readdirSync('Tests')
  .filter((name) => /\.(mht|mhtml)$/i.test(name))
  .map((name) => path.join('Tests', name));

if (!fixtures.length) {
  console.warn('no .mht fixtures found to test');
  process.exit(0);
}

let failed = false;

for (const fixturePath of fixtures) {
  const raw = fs.readFileSync(fixturePath, 'latin1');
  const parsed = parseMht(raw, { EnableCharsetFallback: true, EnableMapping: true });

  const config = {
    EnableCharsetFallback: true,
    imageMap: parsed.imageMap || {}
  };

  const firstRun = await runPipeline(parsed.html || '', config);
  const secondRun = await runPipeline(firstRun.output || '', config);

  const once = normalizeHtml(firstRun.output);
  const twice = normalizeHtml(secondRun.output);

  if (once !== twice) {
    failed = true;
    const idx = firstDiffIndex(once, twice);
    const start = Math.max(0, idx - 80);
    const end = idx + 80;
    const left = once.slice(start, end).replace(/\n/g, '\\n');
    const right = twice.slice(start, end).replace(/\n/g, '\\n');
    console.error(`${path.basename(fixturePath)}: FAIL (non-idempotent output)`);
    console.error(`  first diff index: ${idx}`);
    console.error(`  once : "${left}"`);
    console.error(`  twice: "${right}"`);
    continue;
  }

  console.log(`${path.basename(fixturePath)}: OK`);
}

process.exit(failed ? 1 : 0);
