import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BinaryReader } from '../src/importers/one/binary-reader.js';
import {
  FileNodeListError,
  readFileNodeListFragment
} from '../src/importers/one/file-node-list.js';
import { parseRevisionStoreHeader, RevisionStoreHeaderError } from '../src/importers/one/revision-store.js';
import { getLatestFileNodeListCount, readTransactionLog } from '../src/importers/one/transaction-log.js';

/** @param {string} fileName */
function readFixture(fileName) {
  return fs.readFileSync(path.resolve(process.cwd(), 'Tests', 'onenote-fixtures', fileName));
}

/** @param {string} fileName */
function readRootFragment(fileName) {
  const bytes = readFixture(fileName);
  const header = parseRevisionStoreHeader(new BinaryReader(bytes));
  const reader = new BinaryReader(bytes);
  const transactionLog = readTransactionLog(reader, header.transactionLog, header.transactionCount);
  const rootListId = reader.readUint32LE(Number(header.rootFileNodeList.stp) + 8);
  const expectedNodeCount = getLatestFileNodeListCount(transactionLog, rootListId);
  return readFileNodeListFragment(reader, header.rootFileNodeList, { expectedNodeCount });
}

const fixture1 = readRootFragment('Fixture-1.one');
assert.deepEqual(fixture1, {
  offset: 1024,
  byteLength: 1024,
  fileNodeListId: 16,
  fragmentSequence: 0,
  nextFragment: { stp: 0xFFFFFFFFFFFFFFFFn, cb: 0 },
  hasNextFragment: false,
  paddingByteLength: 910,
  terminatedBy: 'transaction-log-count',
  fileNodes: [
    { offset: 1040, fileNodeId: 8, size: 27, stpFormat: 2, cbFormat: 2, baseType: 2 },
    { offset: 1067, fileNodeId: 4, size: 24, stpFormat: 1, cbFormat: 0, baseType: 0 },
    { offset: 1091, fileNodeId: 8, size: 27, stpFormat: 2, cbFormat: 2, baseType: 2 }
  ]
});
assert.deepEqual(readRootFragment('Fixture-1.one'), fixture1, 'Fixture-1.one: structural intake is deterministic');

const fixture2 = readRootFragment('Fixture-2.one');
assert.equal(fixture2.fileNodes.length, 4, 'Fixture-2.one: multipage fixture has a distinct root structure');
assert.deepEqual(
  fixture2.fileNodes.map(({ fileNodeId, size, baseType }) => ({ fileNodeId, size, baseType })),
  [
    { fileNodeId: 8, size: 27, baseType: 2 },
    { fileNodeId: 4, size: 24, baseType: 0 },
    { fileNodeId: 8, size: 27, baseType: 2 },
    { fileNodeId: 8, size: 27, baseType: 2 }
  ]
);

const fixture3 = readRootFragment('Fixture-3.one');
assert.deepEqual(
  fixture3.fileNodes.at(-1),
  { offset: 1118, fileNodeId: 144, size: 7, stpFormat: 2, cbFormat: 2, baseType: 2 }
);

assert.throws(
  () => parseRevisionStoreHeader(new BinaryReader(readFixture('Fixture-4.one'))),
  (error) => error instanceof RevisionStoreHeaderError && error.code === 'declared-length-mismatch'
);

const invalidFooter = readFixture('Fixture-1.one');
new DataView(invalidFooter.buffer, invalidFooter.byteOffset, invalidFooter.byteLength).setBigUint64(2040, 0n, true);
assert.throws(
  () => readFileNodeListFragment(new BinaryReader(invalidFooter), { stp: 1024n, cb: 1024 }, { expectedNodeCount: 3 }),
  (error) => error instanceof FileNodeListError && error.code === 'invalid-fragment-footer'
);

const invalidNodeSize = readFixture('Fixture-1.one');
const invalidNodeSizeView = new DataView(invalidNodeSize.buffer, invalidNodeSize.byteOffset, invalidNodeSize.byteLength);
const firstNodeHeader = invalidNodeSizeView.getUint32(1040, true);
invalidNodeSizeView.setUint32(1040, (firstNodeHeader & 0xFF8003FF) | (3 << 10), true);
assert.throws(
  () => readFileNodeListFragment(new BinaryReader(invalidNodeSize), { stp: 1024n, cb: 1024 }, { expectedNodeCount: 3 }),
  (error) => error instanceof FileNodeListError && error.code === 'invalid-file-node-size'
);

assert.throws(
  () => readFileNodeListFragment(new BinaryReader(readFixture('Fixture-1.one')), { stp: 1024n, cb: 1024 }, { expectedNodeCount: 3, maxNodeCount: 2 }),
  (error) => error instanceof FileNodeListError && error.code === 'node-count-limit'
);

assert.throws(
  () => readFileNodeListFragment(new BinaryReader(readFixture('Fixture-1.one')), { stp: 1024n, cb: 35 }, { expectedNodeCount: 3 }),
  (error) => error instanceof FileNodeListError && error.code === 'invalid-fragment-range'
);

assert.throws(
  () => readFileNodeListFragment(new BinaryReader(readFixture('Fixture-1.one')), { stp: 1024n, cb: 1024 }, {}),
  (error) => error instanceof FileNodeListError && error.code === 'missing-node-count'
);

console.log('native-one-file-node-list.unit: PASS');