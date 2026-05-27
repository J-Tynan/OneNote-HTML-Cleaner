import fs from 'node:fs';
import path from 'node:path';
import {
  firstDiffIndex,
  normalizeHtmlForDiff,
  setupNodeTestEnvironment
} from './node-test-helper.js';
import { discoverFixtureFiles, resolveFixturePath } from './fixtures.js';

const { parseMht } = await import('../src/pipeline/mht.js');
const { runPipeline } = await import('../src/pipeline/pipeline.js');

await setupNodeTestEnvironment();

console.log('running rerun-equivalence regression test');

const fixtures = discoverFixtureFiles().map(resolveFixturePath);

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

  const left = normalizeHtmlForDiff(runA.output);
  const right = normalizeHtmlForDiff(runB.output);

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
