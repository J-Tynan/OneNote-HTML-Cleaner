import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectSourceKind } from '../src/importers/sourceKind.js';
import { WARNING_CODES } from '../src/importers/warnings.js';

const manifestPath = path.resolve(process.cwd(), 'Tests', 'expected', 'native-one-fixtures.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const knownWarningCodes = new Set(Object.values(WARNING_CODES.one));

assert.equal(manifest.name, 'native-one-fixtures', 'expected native fixture manifest name');
assert(Array.isArray(manifest.fixtures) && manifest.fixtures.length > 0, 'expected at least one native fixture');

const fixtureIds = new Set();
for (const fixture of manifest.fixtures) {
  assert.equal(typeof fixture.id, 'string', 'fixture id must be a string');
  assert(!fixtureIds.has(fixture.id), `fixture id must be unique: ${fixture.id}`);
  fixtureIds.add(fixture.id);
  assert.equal(fixture.sourceKind, 'one', `${fixture.id}: only .one fixtures belong in this manifest`);
  assert.equal(detectSourceKind(fixture.fileName), 'one', `${fixture.id}: fileName must identify a .one file`);
  assert(fs.existsSync(path.resolve(process.cwd(), 'Tests', fixture.fileName)), `${fixture.id}: fixture file is missing`);
  assert(['direct', 'heuristic'].includes(fixture.evidenceLevel), `${fixture.id}: invalid evidence level`);
  assert(['success', 'partial'].includes(fixture.expectedState), `${fixture.id}: invalid expected state`);
  assert(Number.isInteger(fixture.minPageCount) && fixture.minPageCount >= 1, `${fixture.id}: minPageCount must be a positive integer`);
  assert.equal(typeof fixture.shouldCreateZip, 'boolean', `${fixture.id}: shouldCreateZip must be boolean`);
  assert(Array.isArray(fixture.expectedWarningCodes), `${fixture.id}: expectedWarningCodes must be an array`);
  fixture.expectedWarningCodes.forEach((code) => assert(knownWarningCodes.has(code), `${fixture.id}: unknown warning code ${code}`));

  const expectsFallback = fixture.expectedWarningCodes.includes(WARNING_CODES.one.fallbackSemanticSummary);
  if (fixture.evidenceLevel === 'heuristic') {
    assert.equal(fixture.expectedState, 'partial', `${fixture.id}: heuristic coverage must be partial`);
    assert(expectsFallback, `${fixture.id}: heuristic coverage must require a fallback warning`);
  }
  if (fixture.expectedState === 'success') {
    assert(!expectsFallback, `${fixture.id}: success fixtures cannot require heuristic fallback`);
  }
}

console.log('native-one-fixture-manifest.unit: PASS');
