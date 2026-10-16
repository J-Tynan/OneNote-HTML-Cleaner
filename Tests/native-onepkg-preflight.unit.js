import assert from 'node:assert/strict';
import { preflightOnePackage } from '../src/importers/onepkg-preflight.js';
import { WARNING_CODES } from '../src/importers/warnings.js';

const encoder = new TextEncoder();

/** @param {{ name: string, size?: number, offset?: number, folderIndex?: number }[]} entries @param {{ compression?: number, flags?: number }} [options={}] */
function buildCab(entries, options = {}) {
  const folderCount = 1;
  const folderTableOffset = 36;
  const fileTableOffset = folderTableOffset + 8;
  const encodedNames = entries.map((entry) => encoder.encode(entry.name));
  const entryBytes = entries.reduce((total, _entry, index) => total + 16 + encodedNames[index].length + 1, 0);
  const bytes = new Uint8Array(fileTableOffset + entryBytes);
  const view = new DataView(bytes.buffer);
  bytes.set([0x4d, 0x53, 0x43, 0x46], 0);
  view.setUint32(8, bytes.length, true);
  view.setUint32(16, fileTableOffset, true);
  view.setUint16(26, folderCount, true);
  view.setUint16(28, entries.length, true);
  view.setUint16(30, options.flags || 0, true);
  view.setUint32(folderTableOffset, bytes.length, true);
  view.setUint16(folderTableOffset + 4, 0, true);
  view.setUint16(folderTableOffset + 6, options.compression || 0, true);

  let offset = fileTableOffset;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    view.setUint32(offset, entry.offset || 0, true);
    view.setUint32(offset + 4, entry.size || 0, true);
    view.setUint16(offset + 14, entry.folderIndex || 0, true);
    bytes.set(encodedNames[index], offset + 16);
    offset += 16 + encodedNames[index].length + 1;
  }
  return bytes;
}

const validCab = buildCab([
  { name: 'Notebook/Section.one', size: 10 },
  { name: 'Notebook/Contents.onetoc2', size: 12 },
  { name: 'Notebook/readme.txt', size: 3 }
]);
const valid = preflightOnePackage(validCab);
assert.equal(valid.state, 'success');
assert.equal(valid.canInventory, true);
assert.equal(valid.conversionAvailable, false);
assert.deepEqual(valid.entries.map((entry) => [entry.path, entry.kind]), [
  ['Notebook/Section.one', 'section'],
  ['Notebook/Contents.onetoc2', 'table-of-contents'],
  ['Notebook/readme.txt', 'other']
]);
assert.deepEqual(preflightOnePackage(validCab), valid, 'inventory must be deterministic');

const invalidSignature = preflightOnePackage(new Uint8Array(36));
assert.equal(invalidSignature.state, 'hard-failure');
assert.equal(invalidSignature.entries.length, 0);
assert.equal(invalidSignature.warningDetails[0].code, WARNING_CODES.onepkg.invalidSignature);

const truncated = validCab.slice(0, validCab.length - 1);
const truncatedResult = preflightOnePackage(truncated);
assert.equal(truncatedResult.state, 'hard-failure');
assert.equal(truncatedResult.entries.length, 0);

const overlappingTable = validCab.slice();
new DataView(overlappingTable.buffer, overlappingTable.byteOffset, overlappingTable.byteLength).setUint32(16, 40, true);
const overlappingTableResult = preflightOnePackage(overlappingTable);
assert.equal(overlappingTableResult.state, 'hard-failure');
assert.equal(overlappingTableResult.warningDetails[0].code, WARNING_CODES.onepkg.malformedCab);

const unterminatedName = validCab.slice();
unterminatedName[unterminatedName.length - 1] = 0x58;
const unterminatedNameResult = preflightOnePackage(unterminatedName);
assert.equal(unterminatedNameResult.state, 'hard-failure');
assert.equal(unterminatedNameResult.warningDetails[0].code, WARNING_CODES.onepkg.malformedCab);

const unsafePath = preflightOnePackage(buildCab([{ name: '../outside.one' }]));
assert.equal(unsafePath.state, 'hard-failure');
assert.equal(unsafePath.warningDetails[0].code, WARNING_CODES.onepkg.unsafePath);

const duplicatePath = preflightOnePackage(buildCab([{ name: 'Group/Section.one' }, { name: 'group\\section.one' }]));
assert.equal(duplicatePath.state, 'hard-failure');
assert.equal(duplicatePath.warningDetails[0].code, WARNING_CODES.onepkg.duplicatePath);

const invalidFolder = preflightOnePackage(buildCab([{ name: 'Section.one', folderIndex: 1 }]));
assert.equal(invalidFolder.state, 'hard-failure');
assert.equal(invalidFolder.warningDetails[0].code, WARNING_CODES.onepkg.invalidFolderReference);

const multiVolume = preflightOnePackage(buildCab([{ name: 'Section.one' }], { flags: 0x0001 }));
assert.equal(multiVolume.state, 'unsupported');
assert.equal(multiVolume.entries.length, 0);

const unsupportedCompression = preflightOnePackage(buildCab([{ name: 'Section.one' }], { compression: 3 }));
assert.equal(unsupportedCompression.state, 'unsupported');
assert.equal(unsupportedCompression.entries.length, 0);
assert.equal(unsupportedCompression.warningDetails[0].code, WARNING_CODES.onepkg.unsupportedCompression);

const overLimit = preflightOnePackage(buildCab([{ name: 'Section.one', size: 2 }]), { maxEntryBytes: 1 });
assert.equal(overLimit.state, 'unsupported');
assert.equal(overLimit.entries.length, 0);
assert.equal(overLimit.warningDetails[0].code, WARNING_CODES.onepkg.policyLimitExceeded);

console.log('native-onepkg-preflight.unit: PASS');