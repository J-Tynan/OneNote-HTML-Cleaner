import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const CLEANED_DIR = path.join(ROOT, 'Tests', 'Cleaned');
const LOCKED_DIR = path.join(ROOT, 'Tests', 'expected', 'locked-cleaned');
const MANIFEST_PATH = path.join(LOCKED_DIR, 'manifest.json');

function normalizeHtml(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/>\s+</g, '><')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function firstDiffIndex(a, b) {
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return -1;
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`missing locked fixture manifest: ${MANIFEST_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function main() {
  console.log('running locked-fixture regression check');

  if (!fs.existsSync(CLEANED_DIR)) {
    console.error(`missing cleaned directory: ${CLEANED_DIR}`);
    process.exit(1);
  }

  const manifest = readManifest();
  const requiredFiles = Array.isArray(manifest.requiredFiles) ? manifest.requiredFiles : [];
  if (!requiredFiles.length) {
    console.error('manifest requiredFiles is empty');
    process.exit(1);
  }

  let failed = false;

  for (const fileName of requiredFiles) {
    const cleanedPath = path.join(CLEANED_DIR, fileName);
    const lockedPath = path.join(LOCKED_DIR, fileName);

    if (!fs.existsSync(cleanedPath)) {
      failed = true;
      console.error(`${fileName}: missing in Tests/Cleaned`);
      continue;
    }
    if (!fs.existsSync(lockedPath)) {
      failed = true;
      console.error(`${fileName}: missing in Tests/expected/locked-cleaned`);
      continue;
    }

    const cleanedNormalized = normalizeHtml(fs.readFileSync(cleanedPath, 'utf8'));
    const lockedNormalized = normalizeHtml(fs.readFileSync(lockedPath, 'utf8'));

    const manifestHash = manifest.hashes && manifest.hashes[fileName] ? String(manifest.hashes[fileName]) : '';
    const lockedHash = sha256(lockedNormalized);
    if (!manifestHash) {
      failed = true;
      console.error(`${fileName}: missing manifest hash entry`);
      continue;
    }
    if (manifestHash !== lockedHash) {
      failed = true;
      console.error(`${fileName}: locked fixture hash does not match manifest (run npm run fixtures:rebaseline)`);
      continue;
    }

    if (cleanedNormalized !== lockedNormalized) {
      failed = true;
      const idx = firstDiffIndex(cleanedNormalized, lockedNormalized);
      const start = Math.max(0, idx - 80);
      const end = idx + 80;
      console.error(`${fileName}: FAIL (cleaned output drifted from locked baseline)`);
      console.error(`  first diff index: ${idx}`);
      console.error(`  cleaned: "${cleanedNormalized.slice(start, end).replace(/\n/g, '\\n')}"`);
      console.error(`  locked : "${lockedNormalized.slice(start, end).replace(/\n/g, '\\n')}"`);
      continue;
    }

    console.log(`${fileName}: OK`);
  }

  process.exit(failed ? 1 : 0);
}

main();
