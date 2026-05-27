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

console.log('running sanitizer idempotence regression test');

const fixtures = discoverFixtureFiles().map(resolveFixturePath);

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

  const once = normalizeHtmlForDiff(firstRun.output);
  const twice = normalizeHtmlForDiff(secondRun.output);

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
