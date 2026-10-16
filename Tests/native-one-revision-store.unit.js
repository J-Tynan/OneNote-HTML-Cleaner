import assert from 'node:assert/strict';
import { BinaryReadError, BinaryReader } from '../src/importers/one/binary-reader.js';
import {
  FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH,
  ROOT_FILE_NODE_REFERENCE_OFFSET,
  readFileChunkReference64x32,
  readRootFileNodeReference
} from '../src/importers/one/revision-store.js';

assert.equal(FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH, 12);
assert.equal(ROOT_FILE_NODE_REFERENCE_OFFSET, 0x30);

const bytes = new Uint8Array(ROOT_FILE_NODE_REFERENCE_OFFSET + FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH);
const view = new DataView(bytes.buffer);
view.setBigUint64(ROOT_FILE_NODE_REFERENCE_OFFSET, 0x0000000000001000n, true);
view.setUint32(ROOT_FILE_NODE_REFERENCE_OFFSET + 8, 0x00000200, true);

assert.deepEqual(readRootFileNodeReference(bytes), {
  stp: 0x0000000000001000n,
  cb: 0x00000200
});

const reference = new Uint8Array(FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH);
const referenceView = new DataView(reference.buffer);
referenceView.setBigUint64(0, 0x0102030405060708n, true);
referenceView.setUint32(8, 0xAABBCCDD, true);
assert.deepEqual(readFileChunkReference64x32(new BinaryReader(reference), 0), {
  stp: 0x0102030405060708n,
  cb: 0xAABBCCDD
});

assert.throws(
  () => readRootFileNodeReference(new Uint8Array(ROOT_FILE_NODE_REFERENCE_OFFSET + FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH - 1)),
  (error) => error instanceof BinaryReadError && error.code === 'invalid-range'
);

console.log('native-one-revision-store.unit: PASS');