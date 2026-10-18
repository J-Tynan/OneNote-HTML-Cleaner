// @ts-check

/** @typedef {import('./binary-reader.js').BinaryReader} BinaryReader */
/** @typedef {import('./revision-store.js').FileChunkReference64x32} FileChunkReference64x32 */

export const FILE_NODE_LIST_FRAGMENT_HEADER_BYTE_LENGTH = 16;
export const FILE_NODE_LIST_FRAGMENT_NEXT_REFERENCE_BYTE_LENGTH = 12;
export const FILE_NODE_LIST_FRAGMENT_FOOTER_BYTE_LENGTH = 8;
export const FILE_NODE_LIST_FRAGMENT_MINIMUM_BYTE_LENGTH =
  FILE_NODE_LIST_FRAGMENT_HEADER_BYTE_LENGTH
  + FILE_NODE_LIST_FRAGMENT_NEXT_REFERENCE_BYTE_LENGTH
  + FILE_NODE_LIST_FRAGMENT_FOOTER_BYTE_LENGTH;
export const FILE_NODE_LIST_MAGIC = 0xA4567AB1F5F7F4C4n;
export const FILE_NODE_LIST_FOOTER = 0x8BC215C38233BA4Bn;
export const FILE_NODE_CHUNK_TERMINATOR_ID = 0x0FF;
export const FILE_CHUNK_REFERENCE_NIL_OFFSET = 0xFFFFFFFFFFFFFFFFn;
export const DEFAULT_MAX_FILE_NODE_COUNT = 10000;

export class FileNodeListError extends Error {
  /**
  * @param {'invalid-fragment-range' | 'invalid-fragment-magic' | 'invalid-fragment-footer' | 'invalid-file-node-list-id' | 'invalid-next-fragment' | 'missing-node-count' | 'truncated-node-stream' | 'invalid-file-node-header' | 'invalid-file-node-size' | 'node-count-limit'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'FileNodeListError';
    this.code = code;
  }
}

/** @param {FileChunkReference64x32} reference @param {number} fileLength */
function isInFileReference(reference, fileLength) {
  return reference.stp <= BigInt(fileLength)
    && BigInt(reference.cb) <= BigInt(fileLength) - reference.stp;
}

/** @param {number} value @param {string} label */
function toSafeOffset(value, label) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new FileNodeListError('invalid-fragment-range', `${label} is too large to address safely.`);
  }
  return Number(value);
}

/**
 * @typedef {{ expectedNodeCount: number, maxNodeCount?: number }} FileNodeListOptions
 */

/**
 * Read one directly evidenced FileNodeListFragment without following its
 * continuation reference or interpreting file-node payloads. The transaction
 * log supplies the expected node count that separates nodes from padding.
 *
 * @param {BinaryReader} reader
 * @param {FileChunkReference64x32} reference
 * @param {FileNodeListOptions} [options={}]
 */
export function readFileNodeListFragment(reader, reference, options = {}) {
  if (!Number.isSafeInteger(options.expectedNodeCount) || options.expectedNodeCount < 0) {
    throw new FileNodeListError('missing-node-count', 'File-node-list fragment requires a transaction-log node count.');
  }
  const maxNodeCount = Number.isSafeInteger(options.maxNodeCount) && options.maxNodeCount >= 0
    ? options.maxNodeCount
    : DEFAULT_MAX_FILE_NODE_COUNT;
  if (reference.cb < FILE_NODE_LIST_FRAGMENT_MINIMUM_BYTE_LENGTH || !isInFileReference(reference, reader.length)) {
    throw new FileNodeListError('invalid-fragment-range', 'File-node-list fragment range is outside the file or too small.');
  }

  const offset = toSafeOffset(reference.stp, 'File-node-list fragment offset');
  const endOffset = offset + reference.cb;
  const nextFragmentOffset = endOffset
    - FILE_NODE_LIST_FRAGMENT_NEXT_REFERENCE_BYTE_LENGTH
    - FILE_NODE_LIST_FRAGMENT_FOOTER_BYTE_LENGTH;
  const footerOffset = endOffset - FILE_NODE_LIST_FRAGMENT_FOOTER_BYTE_LENGTH;
  const magic = reader.readUint64LE(offset);
  if (magic !== FILE_NODE_LIST_MAGIC) {
    throw new FileNodeListError('invalid-fragment-magic', 'File-node-list fragment has an invalid magic value.');
  }

  const fileNodeListId = reader.readUint32LE(offset + 8);
  if (fileNodeListId < 0x10) {
    throw new FileNodeListError('invalid-file-node-list-id', 'File-node-list fragment has an invalid list identifier.');
  }
  const fragmentSequence = reader.readUint32LE(offset + 12);
  const nextFragment = {
    stp: reader.readUint64LE(nextFragmentOffset),
    cb: reader.readUint32LE(nextFragmentOffset + 8)
  };
  const footer = reader.readUint64LE(footerOffset);
  if (footer !== FILE_NODE_LIST_FOOTER) {
    throw new FileNodeListError('invalid-fragment-footer', 'File-node-list fragment has an invalid footer.');
  }

  const hasNextFragment = nextFragment.stp !== FILE_CHUNK_REFERENCE_NIL_OFFSET;
  if (!hasNextFragment && nextFragment.cb !== 0) {
    throw new FileNodeListError('invalid-next-fragment', 'Terminal file-node-list fragment must use fcrNil.');
  }
  if (hasNextFragment && (nextFragment.stp === 0n || nextFragment.cb < FILE_NODE_LIST_FRAGMENT_MINIMUM_BYTE_LENGTH || !isInFileReference(nextFragment, reader.length))) {
    throw new FileNodeListError('invalid-next-fragment', 'File-node-list continuation reference is invalid.');
  }

  /** @type {Array<{ offset: number, fileNodeId: number, size: number, stpFormat: number, cbFormat: number, baseType: number }>} */
  const fileNodes = [];
  let nodeOffset = offset + FILE_NODE_LIST_FRAGMENT_HEADER_BYTE_LENGTH;
  let terminatedBy = 'transaction-log-count';
  while (fileNodes.length < options.expectedNodeCount) {
    if (fileNodes.length >= maxNodeCount) {
      throw new FileNodeListError('node-count-limit', `File-node-list fragment exceeds the ${maxNodeCount}-node policy.`);
    }
    if (nodeOffset + 4 > nextFragmentOffset) {
      throw new FileNodeListError('truncated-node-stream', 'File-node-list fragment ends before its transaction-log node count.');
    }

    const header = reader.readUint32LE(nodeOffset);
    const fileNodeId = header & 0x3FF;
    const size = (header >>> 10) & 0x1FFF;
    const stpFormat = (header >>> 23) & 0x03;
    const cbFormat = (header >>> 25) & 0x03;
    const baseType = (header >>> 27) & 0x0F;
    const reserved = header >>> 31;
    if (reserved !== 1 || baseType > 2) {
      throw new FileNodeListError('invalid-file-node-header', 'File node has unsupported header flags.');
    }
    if (size < 4 || nodeOffset + size > nextFragmentOffset) {
      throw new FileNodeListError('invalid-file-node-size', 'File node extends outside the fragment node stream.');
    }

    fileNodes.push({ offset: nodeOffset, fileNodeId, size, stpFormat, cbFormat, baseType });
    nodeOffset += size;
    if (fileNodeId === FILE_NODE_CHUNK_TERMINATOR_ID) {
      if (size !== 4 || !hasNextFragment || fileNodes.length !== options.expectedNodeCount) {
        throw new FileNodeListError('invalid-file-node-header', 'Chunk terminator is invalid for this fragment.');
      }
      terminatedBy = 'chunk-terminator';
      break;
    }
  }

  return {
    offset,
    byteLength: reference.cb,
    fileNodeListId,
    fragmentSequence,
    nextFragment,
    hasNextFragment,
    paddingByteLength: nextFragmentOffset - nodeOffset,
    terminatedBy,
    fileNodes
  };
}