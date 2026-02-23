// Tests/mht-charset-discovery.js
// Simple node script to run parseMht with charset logging enabled

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    'fixtures/mht-sample.mht',
    'fixtures/mht-full-snippet.mht',
    'DevToys.mht',
    'Test File.mht',
    'Communicate using Markdown.mht',
    'Resolve merge conflicts.mht'
  ];
  for (const f of fixtures) {
    try {
      await run(f);
    } catch (err) {
      console.error('error parsing', f, err);
    }
  }
}

main().catch(console.error);
