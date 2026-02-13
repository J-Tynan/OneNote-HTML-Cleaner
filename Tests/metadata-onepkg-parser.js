const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const fixturePath = path.resolve(process.cwd(), 'Tests', 'Test Notebook.onepkg');
  if (!fs.existsSync(fixturePath)) {
    fail(`Missing fixture: ${fixturePath}`);
  }

  const importerPath = path.resolve(process.cwd(), 'src', 'importers', 'onepkg.js');
  const importerUrl = pathToFileURL(importerPath).href;
  const warningsPath = path.resolve(process.cwd(), 'src', 'importers', 'warnings.js');
  const warningsUrl = pathToFileURL(warningsPath).href;
  const mod = await import(importerUrl);
  const warningsMod = await import(warningsUrl);
  const WARNING_CODES = warningsMod && warningsMod.WARNING_CODES ? warningsMod.WARNING_CODES : null;
  if (!mod || typeof mod.importOnePackage !== 'function') {
    fail('Could not import importOnePackage from src/importers/onepkg.js');
  }
  if (!WARNING_CODES || !WARNING_CODES.onepkg) {
    fail('Could not import WARNING_CODES from src/importers/warnings.js');
  }

  const bytes = fs.readFileSync(fixturePath);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const result = await mod.importOnePackage(arrayBuffer, { fileName: 'Test Notebook.onepkg' });

  const pages = Array.isArray(result && result.pages) ? result.pages : [];
  if (pages.length < 1) {
    fail('Expected at least one parsed page from Test Notebook.onepkg');
  }

  for (const page of pages) {
    const metadata = page && page.metadata;
    if (!metadata || typeof metadata !== 'object') {
      fail(`Expected metadata object for page: ${String(page && page.path ? page.path : '(unknown path)')}`);
    }

    const requiredKeys = ['title', 'author', 'createdAt', 'modifiedAt', 'notebook', 'sectionPath', 'source'];
    for (const key of requiredKeys) {
      if (!(key in metadata)) {
        fail(`Expected metadata key "${key}" for page: ${String(page && page.path ? page.path : '(unknown path)')}`);
      }
    }
  }

  const warnings = Array.isArray(result && result.warnings) ? result.warnings : [];
  const warningDetails = Array.isArray(result && result.warningDetails) ? result.warningDetails : [];
  const hasExtractionWarning = warnings.some((item) => /generated\s+\d+\s+downloadable page/i.test(String(item || '')));
  if (!hasExtractionWarning) {
    fail('Expected onepkg extraction warning summary to be present');
  }

  const warningCodes = new Set(warningDetails.map((item) => String(item && item.code ? item.code : '')).filter(Boolean));
  if (!warningCodes.has(WARNING_CODES.onepkg.sectionsGeneratedSummary)) {
    fail(`Expected structured warning code ${WARNING_CODES.onepkg.sectionsGeneratedSummary}`);
  }

  console.log('Onepkg metadata propagation test: PASS');
}

main().catch((err) => {
  fail(`Onepkg metadata propagation test failed: ${String(err && err.message ? err.message : err)}`);
});
