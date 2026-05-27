import fs from 'node:fs';
import path from 'node:path';

export const FIXTURE_FILES = Object.freeze({
  RESOLVE_MERGE_CONFLICTS: 'Resolve merge conflicts.mht',
  TEST_FILE: 'Test File.mht',
  COMMUNICATE_MARKDOWN: 'Communicate using Markdown.mht',
  DEVTOOLS: 'DevToys.mht',
  PROBLEMATIC_FULL_SNIPPET: 'Problematic mht-full-snippet.mhtml',
  PROBLEMATIC_SAMPLE: 'Problematic mht-sample.mht',
  SAMPLE_MHT_SNIPPET: 'mht-sample.mht',
  FULL_MHT_SNIPPET: 'mht-full-snippet.mht'
});

function isFixtureFileName(fileName) {
  return /\.(mht|mhtml|eml)$/i.test(String(fileName || ''));
}

function readFileHead(filePath, maxBytes = 262144) {
  const handle = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(maxBytes);
    const bytesRead = fs.readSync(handle, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString('latin1');
  } finally {
    fs.closeSync(handle);
  }
}

function normalizeFixtureHead(head) {
  return String(head || '')
    .replace(/=\r?\n/g, '')
    .replace(/=3D/gi, '=');
}

function isLikelyOneNoteExport(filePath) {
  try {
    const head = normalizeFixtureHead(readFileHead(filePath));
    if (!head) return false;
    return /ProgId\s*content\s*=\s*['\"]?OneNote\.File/i.test(head)
      || /meta\s+name\s*=\s*['\"]Generator['\"][^>]*Microsoft\s+OneNote/i.test(head)
      || /xmlns:o=['\"]urn:schemas-microsoft-com:office:office['\"]/i.test(head)
      || /X-MimeOLE:\s*Produced By Microsoft MimeOLE V6\.00\.2800\.1441/i.test(head);
  } catch {
    return false;
  }
}

function listFixtureFilesFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && isFixtureFileName(entry.name))
    .filter(entry => isLikelyOneNoteExport(path.join(dirPath, entry.name)))
    .map(entry => entry.name);
}

export function discoverFixtureFiles() {
  const testsRoot = path.resolve('Tests');
  const discovered = new Set(listFixtureFilesFromDir(testsRoot));
  return Array.from(discovered).sort((left, right) => left.localeCompare(right));
}

const defaultCoreFixtures = [
  FIXTURE_FILES.RESOLVE_MERGE_CONFLICTS,
  FIXTURE_FILES.TEST_FILE,
  FIXTURE_FILES.COMMUNICATE_MARKDOWN,
  FIXTURE_FILES.DEVTOOLS
];

const discoveredCoreFixtures = discoverFixtureFiles();

export const CORE_NOTE_FIXTURES = Object.freeze(
  discoveredCoreFixtures.length ? discoveredCoreFixtures : defaultCoreFixtures
);

export function resolveFixturePath(fileName) {
  const testsFixturesPath = path.resolve('Tests', 'fixtures', fileName);
  if (fs.existsSync(testsFixturesPath)) return testsFixturesPath;

  const testsRootPath = path.resolve('Tests', fileName);
  if (fs.existsSync(testsRootPath)) return testsRootPath;

  return testsRootPath;
}

export function readFixture(fileName, encoding = 'latin1') {
  return fs.readFileSync(resolveFixturePath(fileName), encoding);
}
