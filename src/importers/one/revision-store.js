// @ts-check

/** @typedef {import('./binary-reader.js').BinaryReader} BinaryReader */

// The on-disk location of FileNodeListRootFileNode remains unverified. Keep
// this generic primitive separate from any RevisionStoreFileHeader field.
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
