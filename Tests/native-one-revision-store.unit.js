import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BinaryReader } from '../src/importers/one/binary-reader.js';
import {
  EXPECTED_FILE_LENGTH_OFFSET,
  FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH,
  FILE_HEADER_BYTE_LENGTH,
  FILE_NODE_LIST_ROOT_REFERENCE_OFFSET,
  parseRevisionStoreHeader,
  readFileChunkReference64x32
} from '../src/importers/one/revision-store.js';
import { ONE_SIGNATURE, preflightOneSection } from '../src/importers/onePreflight.js';

assert.equal(FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH, 12);

const HASHED_CHUNK_LIST_REFERENCE_OFFSET = 0x94;
const TRANSACTION_LOG_REFERENCE_OFFSET = 0xA0;
const FREE_CHUNK_LIST_REFERENCE_OFFSET = 0xB8;

const reference = new Uint8Array(FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH);
const referenceView = new DataView(reference.buffer);
referenceView.setBigUint64(0, 0x0102030405060708n, true);
referenceView.setUint32(8, 0xAABBCCDD, true);
assert.deepEqual(readFileChunkReference64x32(new BinaryReader(reference), 0), {
  stp: 0x0102030405060708n,
  cb: 0xAABBCCDD
});

const fixturePath = path.resolve(process.cwd(), 'Tests', 'Test section.one');
const fixtureBytes = fs.readFileSync(fixturePath);
const fixtureHash = createHash('sha256').update(fixtureBytes).digest('hex');
assert.equal(fixtureBytes.byteLength, 30056);
assert.equal(fixtureHash, 'fc650495212471f1175edd1171a2d8ad917554b0bbd3c5b77e6e7a191d2859d6');
assert.deepEqual(Array.from(fixtureBytes.subarray(0, ONE_SIGNATURE.length)), [...ONE_SIGNATURE]);
assert(fixtureBytes.byteLength >= FILE_HEADER_BYTE_LENGTH);

const fixtureBuffer = fixtureBytes.buffer.slice(fixtureBytes.byteOffset, fixtureBytes.byteOffset + fixtureBytes.byteLength);
const preflight = preflightOneSection(fixtureBuffer, { sourceKind: 'one' });
assert.equal(preflight.state, 'success');
assert.equal(preflight.canConvert, true);

const headerReader = new BinaryReader(fixtureBytes);
assert.deepEqual(Array.from(fixtureBytes.subarray(0x30, 0x40)), [
  0x3F, 0xDD, 0x9A, 0x10, 0x1B, 0x91, 0xF5, 0x49,
  0xA5, 0xD0, 0x17, 0x91, 0xED, 0xC8, 0xAE, 0xD8
]);
assert.equal(headerReader.readUint32LE(0x40), 0x2A);
assert.equal(headerReader.readUint32LE(0x60), 39);
assert.equal(headerReader.readUint64LE(EXPECTED_FILE_LENGTH_OFFSET), BigInt(fixtureBytes.byteLength));

const hashedChunkListReference = readFileChunkReference64x32(headerReader, HASHED_CHUNK_LIST_REFERENCE_OFFSET);
assert.deepEqual(hashedChunkListReference, { stp: 22672n, cb: 1024 });
assert(hashedChunkListReference.stp + BigInt(hashedChunkListReference.cb) <= BigInt(fixtureBytes.byteLength));

const transactionLogReference = readFileChunkReference64x32(headerReader, TRANSACTION_LOG_REFERENCE_OFFSET);
assert.deepEqual(transactionLogReference, { stp: 2048n, cb: 2408 });
assert(transactionLogReference.stp + BigInt(transactionLogReference.cb) <= BigInt(fixtureBytes.byteLength));

const rootFileNodeListReference = readFileChunkReference64x32(headerReader, FILE_NODE_LIST_ROOT_REFERENCE_OFFSET);
assert.deepEqual(rootFileNodeListReference, { stp: 1024n, cb: 1024 });
assert(rootFileNodeListReference.stp + BigInt(rootFileNodeListReference.cb) <= BigInt(fixtureBytes.byteLength));
assert.deepEqual(parseRevisionStoreHeader(new BinaryReader(fixtureBytes)), {
  expectedFileLength: BigInt(fixtureBytes.byteLength),
  transactionCount: 39,
  transactionLog: transactionLogReference,
  rootFileNodeList: rootFileNodeListReference
});

const freeChunkListReference = readFileChunkReference64x32(headerReader, FREE_CHUNK_LIST_REFERENCE_OFFSET);
assert.deepEqual(freeChunkListReference, { stp: 0xFFFFFFFFFFFFFFFFn, cb: 0 });
assert.throws(() => readFileChunkReference64x32(
  new BinaryReader(fixtureBytes.subarray(0, FILE_NODE_LIST_ROOT_REFERENCE_OFFSET + 11)),
  FILE_NODE_LIST_ROOT_REFERENCE_OFFSET
));

const unverifiedReferenceAt30 = readFileChunkReference64x32(new BinaryReader(fixtureBytes), 0x30);
assert(unverifiedReferenceAt30.stp > BigInt(fixtureBytes.byteLength));
assert(unverifiedReferenceAt30.cb > fixtureBytes.byteLength);

console.log('native-one-revision-store.unit: PASS');