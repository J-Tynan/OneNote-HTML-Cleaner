const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function flattenWarningCodeMap(obj, collector = new Set()) {
  if (!obj || typeof obj !== 'object') return collector;
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      collector.add(value);
      continue;
    }
    if (value && typeof value === 'object') {
      flattenWarningCodeMap(value, collector);
    }
  }
  return collector;
}

function assertWarningDetailsContract(label, result, knownCodes) {
  const warningDetails = Array.isArray(result && result.warningDetails) ? result.warningDetails : null;
  if (!warningDetails) {
    fail(`${label}: expected warningDetails array`);
  }

  if (warningDetails.length < 1) {
    fail(`${label}: expected at least one warningDetails entry`);
  }

  for (const item of warningDetails) {
    if (!item || typeof item !== 'object') {
      fail(`${label}: warningDetails entry must be an object`);
    }

    const code = String(item.code || '').trim();
    const message = String(item.message || '').trim();
    const severity = String(item.severity || '').trim();

    if (!code) {
      fail(`${label}: warningDetails entry missing code`);
    }
    if (!knownCodes.has(code)) {
      fail(`${label}: warningDetails code not in WARNING_CODES: ${code}`);
    }
    if (!message) {
      fail(`${label}: warningDetails entry missing message for code ${code}`);
    }
    if (!severity) {
      fail(`${label}: warningDetails entry missing severity for code ${code}`);
    }
  }

  const warnings = Array.isArray(result && result.warnings) ? result.warnings : [];
  if (warnings.length !== warningDetails.length) {
    fail(`${label}: expected warnings/message count parity with warningDetails (${warnings.length} !== ${warningDetails.length})`);
  }
}

async function main() {
  const warningsPath = path.resolve(process.cwd(), 'src', 'importers', 'warnings.js');
  const warningsUrl = pathToFileURL(warningsPath).href;
  const warningsMod = await import(warningsUrl);
  const WARNING_CODES = warningsMod && warningsMod.WARNING_CODES ? warningsMod.WARNING_CODES : null;
  if (!WARNING_CODES) {
    fail('Could not import WARNING_CODES from src/importers/warnings.js');
  }

  const knownCodes = flattenWarningCodeMap(WARNING_CODES);
  if (knownCodes.size < 1) {
    fail('WARNING_CODES is empty');
  }

  const oneFixturePath = path.resolve(process.cwd(), 'Tests', 'Test Section.one');
  if (!fs.existsSync(oneFixturePath)) {
    fail(`Missing fixture: ${oneFixturePath}`);
  }

  const oneImporterPath = path.resolve(process.cwd(), 'src', 'importers', 'one.js');
  const oneImporterUrl = pathToFileURL(oneImporterPath).href;
  const oneMod = await import(oneImporterUrl);
  if (!oneMod || typeof oneMod.importOneSection !== 'function') {
    fail('Could not import importOneSection from src/importers/one.js');
  }

  const oneBytes = fs.readFileSync(oneFixturePath);
  const oneArrayBuffer = oneBytes.buffer.slice(oneBytes.byteOffset, oneBytes.byteOffset + oneBytes.byteLength);
  const oneResult = oneMod.importOneSection(oneArrayBuffer, { fileName: 'Test Section.one' });
  assertWarningDetailsContract('one', oneResult, knownCodes);

  const onepkgFixturePath = path.resolve(process.cwd(), 'Tests', 'Test Notebook.onepkg');
  if (!fs.existsSync(onepkgFixturePath)) {
    fail(`Missing fixture: ${onepkgFixturePath}`);
  }

  const onepkgImporterPath = path.resolve(process.cwd(), 'src', 'importers', 'onepkg.js');
  const onepkgImporterUrl = pathToFileURL(onepkgImporterPath).href;
  const onepkgMod = await import(onepkgImporterUrl);
  if (!onepkgMod || typeof onepkgMod.importOnePackage !== 'function') {
    fail('Could not import importOnePackage from src/importers/onepkg.js');
  }

  const onepkgBytes = fs.readFileSync(onepkgFixturePath);
  const onepkgArrayBuffer = onepkgBytes.buffer.slice(onepkgBytes.byteOffset, onepkgBytes.byteOffset + onepkgBytes.byteLength);
  const onepkgResult = await onepkgMod.importOnePackage(onepkgArrayBuffer, { fileName: 'Test Notebook.onepkg' });
  assertWarningDetailsContract('onepkg', onepkgResult, knownCodes);

  console.log('Warning code contract test: PASS');
}

main().catch((err) => {
  fail(`Warning code contract test failed: ${String(err && err.message ? err.message : err)}`);
});
