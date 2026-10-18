import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BinaryReader } from '../src/importers/one/binary-reader.js';
import { readFileChunkReference64x32 } from '../src/importers/one/revision-store.js';
import { preflightOneSection } from '../src/importers/onePreflight.js';

const TRANSACTION_LOG_REFERENCE_OFFSET = 0xA0;
const FILE_NODE_LIST_ROOT_REFERENCE_OFFSET = 0xAC;
const EXPECTED_TRANSACTION_LOG_REFERENCE = { stp: 2048n, cb: 2408 };
const EXPECTED_ROOT_REFERENCE = { stp: 1024n, cb: 1024 };

/**
 * @param {string} fileName
 * @param {number} byteLength
 * @param {string} sha256
 */
function readFixtureHeaderFacts(fileName, byteLength, sha256) {
  const fixturePath = path.resolve(process.cwd(), 'Tests', 'onenote-fixtures', fileName);
  const bytes = fs.readFileSync(fixturePath);
  assert.equal(bytes.byteLength, byteLength, `${fileName}: locked byte length`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, `${fileName}: locked SHA-256`);

  const preflight = preflightOneSection(bytes, { sourceKind: 'one' });
  assert.equal(preflight.state, 'success', `${fileName}: signature preflight state`);
  assert.equal(preflight.canConvert, true, `${fileName}: signature preflight conversion gate`);

  const reader = new BinaryReader(bytes);
  const transactionLog = readFileChunkReference64x32(reader, TRANSACTION_LOG_REFERENCE_OFFSET);
  const rootFileNodeList = readFileChunkReference64x32(reader, FILE_NODE_LIST_ROOT_REFERENCE_OFFSET);
  const expectedFileLength = reader.readUint64LE(0xC4);

  assert.deepEqual(transactionLog, EXPECTED_TRANSACTION_LOG_REFERENCE, `${fileName}: transaction log reference`);
  assert.deepEqual(rootFileNodeList, EXPECTED_ROOT_REFERENCE, `${fileName}: root file-node-list reference`);
  assert(transactionLog.stp + BigInt(transactionLog.cb) <= BigInt(bytes.byteLength), `${fileName}: transaction log range must be in file`);
  assert(rootFileNodeList.stp + BigInt(rootFileNodeList.cb) <= BigInt(bytes.byteLength), `${fileName}: root file-node-list range must be in file`);

  return {
    expectedFileLength,
    rootFileNodeList,
    transactionLog
  };
}

const fixture1 = readFixtureHeaderFacts(
  'Fixture-1.one',
  14072,
  '48c6eface403b4a4fd9cc97f8ba441f2173d12ff43317b17fa4e08b52a50c20d'
);
assert.equal(fixture1.expectedFileLength, 14072n, 'Fixture-1.one: declared file length');

const fixture2 = readFixtureHeaderFacts(
  'Fixture-2.one',
  20544,
  '64b41f71417a3473a92710cf98dca92e39bcf6ea80e046d696634c80085f71b9'
);
assert.equal(fixture2.expectedFileLength, 20544n, 'Fixture-2.one: declared file length');

const fixture3 = readFixtureHeaderFacts(
  'Fixture-3.one',
  28064,
  '6eece3ebf69c54ae53cbb8c2b63c37ddaa9b288264ec3ccc492e2d29cb9ea663'
);
assert.equal(fixture3.expectedFileLength, 28064n, 'Fixture-3.one: declared file length');

const fixture4 = readFixtureHeaderFacts(
  'Fixture-4.one',
  12829,
  'b354a9993639427169cd217b53465e749548c2b63c858339707323e1e88be7e8'
);
assert.equal(fixture4.expectedFileLength, 14072n, 'Fixture-4.one: preserved source file length');
assert(fixture4.expectedFileLength > 12829n, 'Fixture-4.one: must remain structurally truncated');

assert.deepEqual(
  readFixtureHeaderFacts(
    'Fixture-1.one',
    14072,
    '48c6eface403b4a4fd9cc97f8ba441f2173d12ff43317b17fa4e08b52a50c20d'
  ),
  fixture1,
  'Fixture-1.one: header intake must be deterministic'
);

console.log('native-one-fixture-intake.unit: PASS');