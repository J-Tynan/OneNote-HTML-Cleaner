import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { importOneSection } from '../src/importers/one.js';
import { preflightOneSection } from '../src/importers/onePreflight.js';

const manifestPath = path.resolve(process.cwd(), 'Tests', 'expected', 'native-one-fixtures.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function readArrayBuffer(filePath) {
  const bytes = fs.readFileSync(filePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function resultSummary(result) {
  return {
    state: result.state,
    fallbackPageCount: result.fallbackPageCount,
    filteredOutLineCount: result.filteredOutLineCount,
    pages: result.pages.map((page) => ({
      name: page.name,
      path: page.path,
      html: page.html,
      resources: (page.resources || []).map((resource) => ({
        path: resource.path,
        size: resource.size,
        mimeType: resource.mimeType
      }))
    })),
    warnings: result.warningDetails.map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      message: warning.message,
      context: warning.context || null
    }))
  };
}

for (const fixture of manifest.fixtures) {
  if (fixture.sourceKind !== 'one' || fixture.expectedState === 'hard-failure' || fixture.expectedState === 'unsupported') continue;
  const fixturePath = path.resolve(process.cwd(), 'Tests', fixture.fileName);
  const firstInput = readArrayBuffer(fixturePath);
  const preflight = preflightOneSection(firstInput, { sourceKind: fixture.sourceKind });
  assert.equal(preflight.canConvert, true, `${fixture.id}: fixture must pass .one preflight`);

  const first = importOneSection(firstInput, { fileName: fixture.fileName });
  const second = importOneSection(readArrayBuffer(fixturePath), { fileName: fixture.fileName });
  assert.equal(first.state, fixture.expectedState, `${fixture.id}: unexpected conversion state`);
  assert(first.pages.length >= fixture.expectedMinPageCount, `${fixture.id}: expected at least ${fixture.expectedMinPageCount} pages`);
  if (fixture.shouldCreateZip) {
    assert(first.pages.length > 0, `${fixture.id}: ZIP export requires at least one native page`);
  }

  const warningCodes = new Set(first.warningDetails.map((warning) => warning.code));
  fixture.expectedWarningCodes.forEach((code) => assert(warningCodes.has(code), `${fixture.id}: expected warning code ${code}`));
  assert.deepEqual(resultSummary(first), resultSummary(second), `${fixture.id}: native conversion must be deterministic`);
}

console.log('native-one-conversion.unit: PASS');
