// @ts-check

import { BinaryReader } from './binary-reader.js';

/**
 * The documented OneNote section-file signature.
 * @type {readonly number[]}
 */
export const ONE_SIGNATURE = Object.freeze([
  0xE4, 0x52, 0x5C, 0x7B, 0x8C, 0xD8, 0xA7, 0x4D,
  0xAE, 0xB1, 0x53, 0x78, 0xD0, 0x29, 0x96, 0xD3
]);

/**
 * Validate the only fixture-backed section-header field currently available:
 * the 16-byte file signature at offset zero. Additional fields belong here
 * only after their locations are recorded in the parser evidence index.
 *
 * @param {ArrayBuffer | Uint8Array} input
 * @returns {{ valid: boolean, reason: 'valid' | 'truncated-header' | 'invalid-signature', byteLength: number }}
 */
export function parseOneSectionHeader(input) {
  const reader = new BinaryReader(input, { maxReadBytes: ONE_SIGNATURE.length });
  if (reader.length < ONE_SIGNATURE.length) {
    return { valid: false, reason: 'truncated-header', byteLength: reader.length };
  }

  const signature = reader.readSlice(0, ONE_SIGNATURE.length);
  const valid = ONE_SIGNATURE.every((value, index) => signature[index] === value);
  return {
    valid,
    reason: valid ? 'valid' : 'invalid-signature',
    byteLength: reader.length
  };
}