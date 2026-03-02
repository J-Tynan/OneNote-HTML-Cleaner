// Tests/mht-charset-discovery.js
// Simple node script to run parseMht with charset logging enabled

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FIXTURE_FILES, CORE_NOTE_FIXTURES, resolveFixturePath } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { parseMht } = await import('../src/pipeline/mht.js');

// enable logging flag globally
globalThis.MHT_CHARSET_LOG = true;

async function run(fileName) {
  const filePath = path.resolve(__dirname, fileName);
  console.log(`\n=== parsing ${fileName} ===`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const result = parseMht(raw, { EnableCharsetFallback: true });
  console.log('html length:', result.html ? result.html.length : 'null');
}

async function main() {
  const fixtures = [
    path.join('fixtures', FIXTURE_FILES.SAMPLE_MHT_SNIPPET),
    path.join('fixtures', FIXTURE_FILES.FULL_MHT_SNIPPET),
    ...CORE_NOTE_FIXTURES
  ];
  for (const f of fixtures) {
    try {
      const fixturePath = f.includes(path.sep) ? path.resolve(__dirname, f) : resolveFixturePath(f);
      const relativeLabel = path.isAbsolute(fixturePath)
        ? path.relative(__dirname, fixturePath)
        : f;
      await run(relativeLabel);
    } catch (err) {
      console.error('error parsing', f, err);
    }
  }
}

main().catch(console.error);
