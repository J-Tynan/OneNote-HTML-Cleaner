import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectSourceKind } from '../src/importers/sourceKind.js';
import { WARNING_CODES } from '../src/importers/warnings.js';

const manifestPath = path.resolve(process.cwd(), 'Tests', 'expected', 'native-one-fixtures.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const knownWarningCodes = new Set([
  ...Object.values(WARNING_CODES.one),
  ...Object.values(WARNING_CODES.onepkg)
]);
const supportBuckets = new Set(['transitional', 'default-one', 'default-onepkg', 'conditional-one', 'conditional-onepkg', 'manual']);
const sourceKinds = new Set(['one', 'onepkg']);
const evidenceLevels = new Set(['direct', 'heuristic']);
const resultStates = new Set(['success', 'partial', 'hard-failure', 'unsupported']);

assert.equal(manifest.name, 'native-one-fixtures', 'expected native fixture manifest name');
assert.equal(manifest.schemaVersion, 2, 'expected native fixture manifest schema version');
assert(Array.isArray(manifest.fixtures) && manifest.fixtures.length > 0, 'expected at least one native fixture');

const fixtureIds = new Set();
const manifestFileNames = new Set();
for (const fixture of manifest.fixtures) {
  assert.equal(typeof fixture.id, 'string', 'fixture id must be a string');
  assert(!fixtureIds.has(fixture.id), `fixture id must be unique: ${fixture.id}`);
  fixtureIds.add(fixture.id);
  assert(sourceKinds.has(fixture.sourceKind), `${fixture.id}: invalid source kind`);
  assert.equal(detectSourceKind(fixture.fileName), fixture.sourceKind, `${fixture.id}: fileName must identify its source kind`);
  assert(fs.existsSync(path.resolve(process.cwd(), 'Tests', fixture.fileName)), `${fixture.id}: fixture file is missing`);
  manifestFileNames.add(fixture.fileName);
  assert(supportBuckets.has(fixture.supportBucket), `${fixture.id}: invalid support bucket`);
  assert(evidenceLevels.has(fixture.evidenceLevel), `${fixture.id}: invalid evidence level`);
  assert.equal(typeof fixture.releaseEligible, 'boolean', `${fixture.id}: releaseEligible must be boolean`);
  assert(resultStates.has(fixture.expectedState), `${fixture.id}: invalid expected state`);
  assert.equal(typeof fixture.shouldCreateHtml, 'boolean', `${fixture.id}: shouldCreateHtml must be boolean`);
  assert.equal(typeof fixture.shouldCreateZip, 'boolean', `${fixture.id}: shouldCreateZip must be boolean`);
  assert(Number.isInteger(fixture.expectedMinPageCount) && fixture.expectedMinPageCount >= 0, `${fixture.id}: expectedMinPageCount must be a non-negative integer`);
  assert(Number.isInteger(fixture.expectedSectionCount) && fixture.expectedSectionCount >= 0, `${fixture.id}: expectedSectionCount must be a non-negative integer`);
  assert(Array.isArray(fixture.expectedWarningCodes), `${fixture.id}: expectedWarningCodes must be an array`);
  fixture.expectedWarningCodes.forEach((code) => assert(knownWarningCodes.has(code), `${fixture.id}: unknown warning code ${code}`));
  assert.equal(typeof fixture.expectedManualCheck, 'boolean', `${fixture.id}: expectedManualCheck must be boolean`);
  assert(Array.isArray(fixture.automationTargets) && fixture.automationTargets.length > 0, `${fixture.id}: automationTargets must name at least one test`);
  fixture.automationTargets.forEach((target) => assert.equal(typeof target, 'string', `${fixture.id}: automation target must be a string`));
  assert.equal(typeof fixture.notes, 'string', `${fixture.id}: notes must be a string`);

  const expectsFallback = fixture.expectedWarningCodes.includes(WARNING_CODES.one.fallbackSemanticSummary);
  if (fixture.evidenceLevel === 'heuristic') {
    assert.equal(fixture.supportBucket, 'transitional', `${fixture.id}: heuristic coverage must remain transitional`);
    assert.equal(fixture.releaseEligible, false, `${fixture.id}: heuristic coverage cannot be release eligible`);
    assert.equal(fixture.expectedState, 'partial', `${fixture.id}: heuristic coverage must be partial`);
    if (fixture.sourceKind === 'one') {
      assert(expectsFallback, `${fixture.id}: heuristic .one coverage must require a fallback warning`);
    }
  }
  if (fixture.releaseEligible) {
    assert.equal(fixture.evidenceLevel, 'direct', `${fixture.id}: release-eligible coverage must be direct`);
    assert.notEqual(fixture.supportBucket, 'transitional', `${fixture.id}: release-eligible coverage cannot be transitional`);
  }
  if (fixture.expectedState === 'success' || fixture.releaseEligible) {
    assert(!expectsFallback, `${fixture.id}: success fixtures cannot require heuristic fallback`);
  }
}

const fixtureFiles = fs.readdirSync(path.resolve(process.cwd(), 'Tests'))
  .filter((fileName) => detectSourceKind(fileName) === 'one' || detectSourceKind(fileName) === 'onepkg');
assert.deepEqual([...manifestFileNames].sort(), fixtureFiles.sort(), 'every native binary fixture must have one manifest record');

console.log('native-one-fixture-manifest.unit: PASS');
