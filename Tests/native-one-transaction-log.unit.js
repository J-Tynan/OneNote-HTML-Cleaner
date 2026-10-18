import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BinaryReader } from '../src/importers/one/binary-reader.js';
import { parseRevisionStoreHeader } from '../src/importers/one/revision-store.js';
import {
  getLatestFileNodeListCount,
  readTransactionLog,
  TransactionLogError
} from '../src/importers/one/transaction-log.js';

/** @param {string} fileName */
function readFixture(fileName) {
  return fs.readFileSync(path.resolve(process.cwd(), 'Tests', 'onenote-fixtures', fileName));
}

for (const [fileName, transactionCount, nodeCount] of [
  ['Fixture-1.one', 16, 3],
  ['Fixture-2.one', 20, 4],
  ['Fixture-3.one', 17, 4]
]) {
  const bytes = readFixture(fileName);
  const reader = new BinaryReader(bytes);
  const header = parseRevisionStoreHeader(reader);
  const log = readTransactionLog(reader, header.transactionLog, header.transactionCount);
  const fileNodeListId = reader.readUint32LE(Number(header.rootFileNodeList.stp) + 8);
  assert.equal(log.transactions.length, transactionCount, `${fileName}: declared transaction count`);
  assert.equal(getLatestFileNodeListCount(log, fileNodeListId), nodeCount, `${fileName}: latest root-list node count`);
}

const fixture1 = readFixture('Fixture-1.one');
const fixture1Reader = new BinaryReader(fixture1);
const fixture1Header = parseRevisionStoreHeader(fixture1Reader);
assert.throws(
  () => readTransactionLog(fixture1Reader, fixture1Header.transactionLog, fixture1Header.transactionCount, { maxTransactions: 1 }),
  (error) => error instanceof TransactionLogError && error.code === 'transaction-count-limit'
);
assert.throws(
  () => readTransactionLog(fixture1Reader, { stp: 2048n, cb: 7 }, 1),
  (error) => error instanceof TransactionLogError && error.code === 'truncated-transaction-log'
);
assert.throws(
  () => getLatestFileNodeListCount({ transactions: [[]] }, 16),
  (error) => error instanceof TransactionLogError && error.code === 'missing-file-node-list-count'
);

console.log('native-one-transaction-log.unit: PASS');