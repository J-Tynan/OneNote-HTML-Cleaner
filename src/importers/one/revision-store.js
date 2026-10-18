// @ts-check

/** @typedef {import('./binary-reader.js').BinaryReader} BinaryReader */

export const FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH = 12;
export const FILE_HEADER_BYTE_LENGTH = 1024;
export const TRANSACTION_COUNT_OFFSET = 0x60;
export const TRANSACTION_LOG_REFERENCE_OFFSET = 0xA0;
export const FILE_NODE_LIST_ROOT_REFERENCE_OFFSET = 0xAC;
export const EXPECTED_FILE_LENGTH_OFFSET = 0xC4;

/**
 * @typedef {{ stp: bigint, cb: number }} FileChunkReference64x32
 */

/**
 * Read a `FileChunkReference64x32` without interpreting its target. The
 * caller must validate the target's record layout before following it.
 *
 * @param {BinaryReader} reader
 * @param {number} offset
 * @returns {FileChunkReference64x32}
 */
export function readFileChunkReference64x32(reader, offset) {
  return {
    stp: reader.readUint64LE(offset),
    cb: reader.readUint32LE(offset + 8)
  };
}

export class RevisionStoreHeaderError extends Error {
  /**
   * @param {'truncated-header' | 'declared-length-mismatch' | 'invalid-required-reference'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'RevisionStoreHeaderError';
    this.code = code;
  }
}

/** @param {FileChunkReference64x32} reference @param {number} fileLength */
function isRequiredInFileReference(reference, fileLength) {
  return reference.stp !== 0n
    && reference.stp !== 0xFFFFFFFFFFFFFFFFn
    && reference.cb > 0
    && reference.stp <= BigInt(fileLength)
    && BigInt(reference.cb) <= BigInt(fileLength) - reference.stp;
}

/**
 * Read the directly evidenced portion of the MS-ONESTORE Header structure.
 * It deliberately stops at physical-file metadata and references.
 *
 * @param {BinaryReader} reader
 */
export function parseRevisionStoreHeader(reader) {
  if (reader.length < FILE_HEADER_BYTE_LENGTH) {
    throw new RevisionStoreHeaderError(
      'truncated-header',
      `Revision-store header requires ${FILE_HEADER_BYTE_LENGTH} bytes, but the file contains ${reader.length}.`
    );
  }

  const expectedFileLength = reader.readUint64LE(EXPECTED_FILE_LENGTH_OFFSET);
  if (expectedFileLength !== BigInt(reader.length)) {
    throw new RevisionStoreHeaderError(
      'declared-length-mismatch',
      `Revision-store header declares ${expectedFileLength} bytes, but the file contains ${reader.length}.`
    );
  }

  const transactionLog = readFileChunkReference64x32(reader, TRANSACTION_LOG_REFERENCE_OFFSET);
  const rootFileNodeList = readFileChunkReference64x32(reader, FILE_NODE_LIST_ROOT_REFERENCE_OFFSET);
  const transactionCount = reader.readUint32LE(TRANSACTION_COUNT_OFFSET);
  for (const [name, reference] of [
    ['transaction log', transactionLog],
    ['root file-node list', rootFileNodeList]
  ]) {
    if (!isRequiredInFileReference(reference, reader.length)) {
      throw new RevisionStoreHeaderError(
        'invalid-required-reference',
        `Revision-store ${name} reference is missing or outside the file.`
      );
    }
  }

  return {
    expectedFileLength,
    transactionCount,
    transactionLog,
    rootFileNodeList
  };
}
