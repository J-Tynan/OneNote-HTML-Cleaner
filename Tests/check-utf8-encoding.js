import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dirFlag = args.indexOf('--dir');
const targetDir = dirFlag >= 0 && args[dirFlag + 1]
  ? args[dirFlag + 1]
  : path.join('Tests', 'Cleaned');

const utf8MetaRe = /<meta\s+charset\s*=\s*["']?utf-8["']?\s*\/?>/i;

if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
  console.error(`directory not found: ${targetDir}`);
  process.exit(1);
}

const decoder = new TextDecoder('utf-8', { fatal: true });
const files = fs.readdirSync(targetDir).filter((f) => /\.html?$/i.test(f));

if (!files.length) {
  console.error(`no html files found in: ${targetDir}`);
  process.exit(1);
}

let failed = false;

for (const file of files) {
  const full = path.join(targetDir, file);
  const raw = fs.readFileSync(full);

  let decoded;
  try {
    decoded = decoder.decode(raw);
  } catch (error) {
    console.error(`${file}: invalid UTF-8 byte sequence (${error.message})`);
    failed = true;
    continue;
  }

  if (!utf8MetaRe.test(decoded)) {
    console.error(`${file}: missing <meta charset=\"utf-8\"> declaration`);
    failed = true;
    continue;
  }

  const roundTrip = Buffer.from(decoded, 'utf8');
  if (!roundTrip.equals(raw)) {
    console.error(`${file}: UTF-8 round-trip mismatch`);
    failed = true;
    continue;
  }

  console.log(`${file}: OK`);
}

process.exit(failed ? 1 : 0);
