import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { preflightOneSection } from '../src/importers/onePreflight.js';
import { WARNING_CODES } from '../src/importers/warnings.js';

const fixturePath = path.resolve(process.cwd(), 'Tests', 'Test Section.one');
const fixture = fs.readFileSync(fixturePath);
const fixtureBytes = fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength);
const ONE_SIGNATURE_LENGTH = 16;

const valid = preflightOneSection(fixtureBytes, { sourceKind: 'one' });
assert.equal(valid.state, 'success', 'expected the native fixture to pass preflight');
assert.equal(valid.canConvert, true, 'expected the native fixture to be convertible');
assert.equal(valid.warningDetails[0].code, WARNING_CODES.one.signatureValidated);

const wrongSource = preflightOneSection(fixtureBytes, { sourceKind: 'mht' });
assert.equal(wrongSource.state, 'unsupported');
assert.equal(wrongSource.canConvert, false);
assert.equal(wrongSource.warningDetails[0].code, WARNING_CODES.one.invalidExtension);

const missingBytes = preflightOneSection(new ArrayBuffer(0));
assert.equal(missingBytes.state, 'hard-failure');
assert.equal(missingBytes.warningDetails[0].code, WARNING_CODES.one.missingBytes);

const invalidSignature = preflightOneSection(new Uint8Array(ONE_SIGNATURE_LENGTH));
assert.equal(invalidSignature.state, 'hard-failure');
assert.equal(invalidSignature.warningDetails[0].code, WARNING_CODES.one.invalidSignature);

const truncated = preflightOneSection(fixtureBytes.slice(0, 15));
assert.equal(truncated.state, 'hard-failure');
assert.equal(truncated.warningDetails[0].code, WARNING_CODES.one.invalidSignature);

const tooLarge = preflightOneSection(fixtureBytes, {
  maxBytes: fixture.byteLength - 1
});
assert.equal(tooLarge.state, 'unsupported');
assert.equal(tooLarge.canConvert, false);
assert.equal(tooLarge.warningDetails[0].code, WARNING_CODES.one.sizeLimitExceeded);
assert.deepEqual(tooLarge.warningDetails[0].context, {
  actualBytes: fixture.byteLength,
  maxBytes: fixture.byteLength - 1
});

console.log('native-one-preflight.unit: PASS');
