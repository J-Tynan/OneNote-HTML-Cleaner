const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const fixturePath = path.resolve(process.cwd(), 'Tests', 'Test Section.one');
  if (!fs.existsSync(fixturePath)) {
    fail(`Missing fixture: ${fixturePath}`);
  }

  const importerPath = path.resolve(process.cwd(), 'src', 'importers', 'one.js');
  const importerUrl = pathToFileURL(importerPath).href;
  const warningsPath = path.resolve(process.cwd(), 'src', 'importers', 'warnings.js');
  const warningsUrl = pathToFileURL(warningsPath).href;
  const mod = await import(importerUrl);
  const warningsMod = await import(warningsUrl);
  const WARNING_CODES = warningsMod && warningsMod.WARNING_CODES ? warningsMod.WARNING_CODES : null;
  if (!mod || typeof mod.importOneSection !== 'function') {
    fail('Could not import importOneSection from src/importers/one.js');
  }
  if (!WARNING_CODES || !WARNING_CODES.one) {
    fail('Could not import WARNING_CODES from src/importers/warnings.js');
  }

  const bytes = fs.readFileSync(fixturePath);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const result = mod.importOneSection(arrayBuffer, { fileName: 'Test Section.one' });

  const pages = Array.isArray(result && result.pages) ? result.pages : [];
  if (pages.length < 1) {
    fail('Expected at least one parsed page from Test Section.one');
  }

  const html = String((pages[0] && pages[0].html) || '');
  if (!/<h1>\s*[^<]+\s*<\/h1>/i.test(html)) {
    fail('Expected semantic page title <h1> in first parsed page');
  }
  if (!/<(p|ul|ol|table|h2|h3)\b/i.test(html)) {
    fail('Expected semantic content blocks (p/ul/ol/table/h2/h3) in first parsed page');
  }

  const metadata = pages[0] && pages[0].metadata;
  if (!metadata || typeof metadata !== 'object') {
    fail('Expected first parsed page to include metadata object');
  }

  const requiredMetadataKeys = ['title', 'author', 'createdAt', 'modifiedAt'];
  for (const key of requiredMetadataKeys) {
    if (!(key in metadata)) {
      fail(`Expected metadata key "${key}" on first parsed page`);
    }
  }

  const warnings = Array.isArray(result && result.warnings) ? result.warnings : [];
  const warningDetails = Array.isArray(result && result.warningDetails) ? result.warningDetails : [];
  const hasConfidenceDiagnostic = warnings.some((item) => /filtered out\s+\d+\s+low-confidence line/i.test(String(item || '')));
  if (!hasConfidenceDiagnostic) {
    fail('Expected parser confidence diagnostic warning about filtered low-confidence lines');
  }

  const hasMetadataDiagnostic = warnings.some((item) => /Metadata canonicalization produced\s+\d+\s+page metadata object/i.test(String(item || '')));
  if (!hasMetadataDiagnostic) {
    fail('Expected parser metadata canonicalization diagnostic warning');
  }

  const warningCodes = new Set(warningDetails.map((item) => String(item && item.code ? item.code : '')).filter(Boolean));
  if (!warningCodes.has(WARNING_CODES.one.fallbackSemanticSummary)) {
    fail(`Expected structured warning code ${WARNING_CODES.one.fallbackSemanticSummary}`);
  }
  if (!warningCodes.has(WARNING_CODES.one.metadataCanonicalizationSummary)) {
    fail(`Expected structured warning code ${WARNING_CODES.one.metadataCanonicalizationSummary}`);
  }

  console.log('Native parser semantic test: PASS');
}

main().catch((err) => {
  fail(`Native parser semantic test failed: ${String(err && err.message ? err.message : err)}`);
});
