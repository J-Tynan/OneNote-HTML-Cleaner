// @ts-check

import { BinaryReader } from './binary-reader.js';

/**
 * `FileNodeListRootFileNode` is a `FileChunkReference64x32` at byte offset
 * 0x30 in `RevisionStoreFileHeader` (MS-ONE section 2.2.1).
 */
export const ROOT_FILE_NODE_REFERENCE_OFFSET = 0x30;
export const FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH = 12;

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

/**
 * Read the root file-node-list reference from an already preflighted section.
 * This is intentionally not a file-node traversal: fragment-header and node
 * layouts require their own fixture-backed validation before following `stp`.
 *
 * @param {ArrayBuffer | Uint8Array} input
 * @returns {FileChunkReference64x32}
 */
export function readRootFileNodeReference(input) {
  const reader = new BinaryReader(input, { maxReadBytes: FILE_CHUNK_REFERENCE64X32_BYTE_LENGTH });
  return readFileChunkReference64x32(reader, ROOT_FILE_NODE_REFERENCE_OFFSET);
}