import assert from 'node:assert/strict';
import { BinaryReadError, BinaryReader } from '../src/importers/one/binary-reader.js';
import { ONE_SIGNATURE, parseOneSectionHeader } from '../src/importers/one/section-header.js';

const bytes = new Uint8Array([
  0x01,
  0x34, 0x12,
  0x78, 0x56, 0x34, 0x12,
  0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01,
  0x33, 0x22, 0x11, 0x00, 0x55, 0x44, 0x77, 0x66, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
  0x41, 0x00, 0x42, 0x00
]);
const reader = new BinaryReader(bytes);

assert.equal(reader.readUint8(0), 0x01);
assert.equal(reader.readUint16LE(1), 0x1234);
assert.equal(reader.readUint32LE(3), 0x12345678);
assert.equal(reader.readUint64LE(7), 0x0102030405060708n);
assert.equal(reader.readGuid(15), '00112233-4455-6677-8899-aabbccddeeff');
assert.equal(reader.readUtf16LE(31, 4), 'AB');

assert.throws(() => reader.readUint32LE(bytes.length - 2), (error) => error instanceof BinaryReadError && error.code === 'invalid-range');
assert.throws(() => reader.readUtf16LE(0, 3), (error) => error instanceof BinaryReadError && error.code === 'invalid-utf16-length');
assert.throws(() => new BinaryReader(bytes, { maxReadBytes: 1 }).readUint16LE(0), (error) => error instanceof BinaryReadError && error.code === 'read-budget-exceeded');

const validHeader = parseOneSectionHeader(new Uint8Array([...ONE_SIGNATURE, 0x00]));
assert.deepEqual(validHeader, { valid: true, reason: 'valid', byteLength: 17 });
assert.deepEqual(parseOneSectionHeader(new Uint8Array(ONE_SIGNATURE.length - 1)), {
  valid: false,
  reason: 'truncated-header',
  byteLength: ONE_SIGNATURE.length - 1
});
assert.deepEqual(parseOneSectionHeader(new Uint8Array(ONE_SIGNATURE.length)), {
  valid: false,
  reason: 'invalid-signature',
  byteLength: ONE_SIGNATURE.length
});

console.log('native-one-binary-reader.unit: PASS');