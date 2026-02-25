import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const CLEANED_DIR = path.join(ROOT, 'Tests', 'Cleaned');
const EXPECTED_DIR = path.join(ROOT, 'Tests', 'expected', 'locked-cleaned');
const REGRESSION_FIXTURE = path.join(ROOT, 'Tests', 'expected', 'native-regression.json');
const MANIFEST_PATH = path.join(EXPECTED_DIR, 'manifest.json');

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

function loadRequiredFiles() {
  const json = JSON.parse(fs.readFileSync(REGRESSION_FIXTURE, 'utf8'));
  return Array.isArray(json.requiredFiles) ? json.requiredFiles : [];
}

function main() {
  if (!fs.existsSync(CLEANED_DIR)) {
    console.error(`cleaned directory not found: ${CLEANED_DIR}`);
    process.exit(1);
  }

  const requiredFiles = loadRequiredFiles();
  if (!requiredFiles.length) {
    console.error('no requiredFiles found in Tests/expected/native-regression.json');
    process.exit(1);
  }

  fs.mkdirSync(EXPECTED_DIR, { recursive: true });

  const hashes = {};
  for (const fileName of requiredFiles) {
    const src = path.join(CLEANED_DIR, fileName);
    const dst = path.join(EXPECTED_DIR, fileName);

    if (!fs.existsSync(src)) {
      console.error(`required cleaned fixture missing: ${src}`);
      process.exit(1);
    }

    const raw = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dst, raw, 'utf8');
    hashes[fileName] = sha256(normalizeHtml(raw));
    console.log(`locked ${fileName}`);
  }

  const manifest = {
    name: 'locked-cleaned-fixtures',
    updatedAt: new Date().toISOString(),
    source: 'Tests/Cleaned',
    requiredFiles,
    normalization: {
      lineEndings: 'LF',
      interTagWhitespaceCollapsed: true,
      trimTrailingWhitespaceLines: true
    },
    hashes
  };

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`wrote ${path.relative(ROOT, MANIFEST_PATH).replace(/\\/g, '/')}`);
}

main();
