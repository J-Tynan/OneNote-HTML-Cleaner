// @ts-check

import { BinaryReadError, BinaryReader } from './one/binary-reader.js';
import { makeWarning, toWarningMessages, WARNING_CODES } from './warnings.js';

/**
 * @typedef {import('../contracts.js').WarningDetail} WarningDetail
 * @typedef {{ fileName?: string, sourceKind?: string, maxBytes?: number, maxFolders?: number, maxEntries?: number, maxEntryNameBytes?: number, maxEntryBytes?: number, maxDeclaredBytes?: number, allowedCompressionKinds?: string[] }} OnePkgPreflightOptions
 * @typedef {'none' | 'mszip' | 'quantum' | 'lzx' | 'unknown'} CabCompressionKind
 * @typedef {'section' | 'table-of-contents' | 'other'} CabEntryKind
 * @typedef {{ index: number, path: string, kind: CabEntryKind, size: number, uncompressedOffset: number, folderIndex: number }} CabInventoryEntry
 * @typedef {{ state: 'success' | 'hard-failure' | 'unsupported', canInventory: boolean, conversionAvailable: false, entries: CabInventoryEntry[], compressionKinds: CabCompressionKind[], warningDetails: WarningDetail[], warnings: string[] }} OnePkgPreflightResult
 */

export const CAB_HEADER_BYTE_LENGTH = 36;
const CAB_FLAG_PREV = 0x0001;
const CAB_FLAG_NEXT = 0x0002;
const CAB_FLAG_RESERVE = 0x0004;
const CAB_KNOWN_FLAGS = CAB_FLAG_PREV | CAB_FLAG_NEXT | CAB_FLAG_RESERVE;
const MAX_CAB_OFFSET = 0x1_0000_0000;
const DEFAULT_MAX_ENTRY_NAME_BYTES = 4096;

class CabPreflightError extends Error {
  /** @param {string} code @param {string} message @param {'hard-failure' | 'unsupported'} [state='hard-failure'] @param {Record<string, unknown>} [context] */
  constructor(code, message, state = 'hard-failure', context = undefined) {
    super(message);
    this.name = 'CabPreflightError';
    this.code = code;
    this.state = state;
    this.context = context;
  }
}

/** @param {unknown} value @param {number} fallback */
function positiveIntegerOption(value, fallback) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : fallback;
}

/** @param {unknown} input */
function normalizeBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return null;
}

/** @param {number} offset @param {number} length @param {number} limit @param {string} label */
function assertCabRange(offset, length, limit, label) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset > limit || length > limit - offset) {
    throw new CabPreflightError(
      WARNING_CODES.onepkg.malformedCab,
      `This .onepkg has an invalid ${label} range. No output was created.`,
      'hard-failure',
      { offset, length, cabinetBytes: limit }
    );
  }
}

/** @param {number} count @param {number} itemBytes @param {number} start @param {number} limit @param {string} label */
function checkedTableEnd(count, itemBytes, start, limit, label) {
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(itemBytes) || count < 0 || itemBytes < 0 || count > Math.floor((limit - start) / itemBytes)) {
    throw new CabPreflightError(
      WARNING_CODES.onepkg.malformedCab,
      `This .onepkg has an invalid ${label}. No output was created.`,
      'hard-failure',
      { count, itemBytes, start, cabinetBytes: limit }
    );
  }
  return start + count * itemBytes;
}

/** @param {number} typeCompress @returns {CabCompressionKind} */
function compressionKind(typeCompress) {
  switch (typeCompress & 0x000f) {
    case 0x0000: return 'none';
    case 0x0001: return 'mszip';
    case 0x0002: return 'quantum';
    case 0x0003: return 'lzx';
    default: return 'unknown';
  }
}

/** @param {string} path @returns {CabEntryKind} */
function entryKind(path) {
  const lower = path.toLocaleLowerCase('en-US');
  if (lower.endsWith('.one')) return 'section';
  if (lower.endsWith('.onetoc2')) return 'table-of-contents';
  return 'other';
}

/** @param {string} name */
function normalizeCabEntryPath(name) {
  if (!name || /[\u0000-\u001F]/.test(name)) {
    throw new CabPreflightError(WARNING_CODES.onepkg.unsafePath, 'This .onepkg contains an empty or control-character entry path. No output was created.');
  }
  if (/^[\\/]|^[A-Za-z]:/.test(name)) {
    throw new CabPreflightError(WARNING_CODES.onepkg.unsafePath, 'This .onepkg contains an absolute entry path. No output was created.');
  }
  const parts = name.replace(/\\/g, '/').split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new CabPreflightError(WARNING_CODES.onepkg.unsafePath, 'This .onepkg contains an unsafe entry path. No output was created.');
  }
  return parts.join('/');
}

/** @param {string} path */
function pathIdentity(path) {
  return path.normalize('NFC').toLocaleLowerCase('en-US');
}

/** @param {BinaryReader} reader @param {Uint8Array} bytes @param {number} start @param {number} cabinetBytes @param {number} maxNameBytes */
function readCabName(reader, bytes, start, cabinetBytes, maxNameBytes) {
  assertCabRange(start, 1, cabinetBytes, 'file name');
  const endLimit = Math.min(cabinetBytes, start + maxNameBytes);
  let end = start;
  while (end < endLimit && bytes[end] !== 0) end += 1;
  if (end === endLimit) {
    const code = endLimit < cabinetBytes ? WARNING_CODES.onepkg.policyLimitExceeded : WARNING_CODES.onepkg.malformedCab;
    const state = endLimit < cabinetBytes ? 'unsupported' : 'hard-failure';
    throw new CabPreflightError(code, 'This .onepkg has an unterminated or over-limit CAB entry name. No output was created.', state, { maxEntryNameBytes: maxNameBytes });
  }
  const nameBytes = reader.readSlice(start, end - start);
  let name;
  try {
    name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
  } catch (_error) {
    throw new CabPreflightError(WARNING_CODES.onepkg.malformedCab, 'This .onepkg contains an invalid UTF-8 CAB entry name. No output was created.');
  }
  return { name, nextOffset: end + 1 };
}

/** @param {'success' | 'hard-failure' | 'unsupported'} state @param {WarningDetail} warning @param {CabInventoryEntry[]} [entries=[]] @param {CabCompressionKind[]} [compressionKinds=[]] */
function result(state, warning, entries = [], compressionKinds = []) {
  const warningDetails = [warning];
  return {
    state,
    canInventory: state === 'success',
    conversionAvailable: false,
    entries: state === 'success' ? entries : [],
    compressionKinds,
    warningDetails,
    warnings: toWarningMessages(warningDetails)
  };
}

/**
 * Validate and inventory a single CAB-backed `.onepkg` without reading any
 * CFDATA payload, decompressing bytes, or generating output pages.
 *
 * @param {ArrayBuffer | Uint8Array | null | undefined} input
 * @param {OnePkgPreflightOptions} [options={}]
 * @returns {OnePkgPreflightResult}
 */
export function preflightOnePackage(input, options = {}) {
  const sourceKind = String(options.sourceKind || 'onepkg').toLowerCase();
  if (sourceKind !== 'onepkg') {
    return result('unsupported', makeWarning(
      WARNING_CODES.onepkg.invalidExtension,
      'Native package import expects a .onepkg file.',
      'error'
    ));
  }

  const bytes = normalizeBytes(input);
  if (!bytes || bytes.length === 0) {
    return result('hard-failure', makeWarning(
      WARNING_CODES.onepkg.missingBytes,
      'This .onepkg file is empty or could not be read. No output was created.',
      'error'
    ));
  }

  const maxBytes = positiveIntegerOption(options.maxBytes, Number.POSITIVE_INFINITY);
  if (bytes.length > maxBytes) {
    return result('unsupported', makeWarning(
      WARNING_CODES.onepkg.sizeLimitExceeded,
      `This .onepkg file exceeds the configured browser import limit of ${maxBytes} bytes. No output was created.`,
      'error',
      { actualBytes: bytes.length, maxBytes }
    ));
  }

  try {
    if (bytes.length < CAB_HEADER_BYTE_LENGTH) {
      throw new CabPreflightError(WARNING_CODES.onepkg.malformedCab, 'This .onepkg file is shorter than a CAB header. No output was created.');
    }

    const reader = new BinaryReader(bytes);
    const signature = new TextDecoder('ascii').decode(reader.readSlice(0, 4));
    if (signature !== 'MSCF') {
      throw new CabPreflightError(WARNING_CODES.onepkg.invalidSignature, 'This .onepkg file does not have a CAB signature. No output was created.');
    }

    const cabinetBytes = reader.readUint32LE(8);
    if (cabinetBytes !== bytes.length) {
      throw new CabPreflightError(WARNING_CODES.onepkg.malformedCab, 'This .onepkg CAB size does not match the supplied file length. No output was created.', 'hard-failure', { declaredBytes: cabinetBytes, actualBytes: bytes.length });
    }
    const fileTableOffset = reader.readUint32LE(16);
    const folderCount = reader.readUint16LE(26);
    const entryCount = reader.readUint16LE(28);
    const flags = reader.readUint16LE(30);
    if ((flags & ~CAB_KNOWN_FLAGS) !== 0) {
      throw new CabPreflightError(WARNING_CODES.onepkg.malformedCab, 'This .onepkg CAB header has unknown flags. No output was created.');
    }
    if ((flags & (CAB_FLAG_PREV | CAB_FLAG_NEXT)) !== 0) {
      throw new CabPreflightError(WARNING_CODES.onepkg.malformedCab, 'This .onepkg spans multiple CAB volumes, which v1.0 does not support. No output was created.', 'unsupported');
    }

    const maxFolders = positiveIntegerOption(options.maxFolders, Number.POSITIVE_INFINITY);
    const maxEntries = positiveIntegerOption(options.maxEntries, Number.POSITIVE_INFINITY);
    if (folderCount > maxFolders || entryCount > maxEntries) {
      throw new CabPreflightError(WARNING_CODES.onepkg.policyLimitExceeded, 'This .onepkg exceeds the configured folder or entry limit. No output was created.', 'unsupported', { folderCount, entryCount, maxFolders, maxEntries });
    }

    let folderTableOffset = CAB_HEADER_BYTE_LENGTH;
    let folderReserveBytes = 0;
    if ((flags & CAB_FLAG_RESERVE) !== 0) {
      assertCabRange(CAB_HEADER_BYTE_LENGTH, 4, cabinetBytes, 'reserve header');
      const headerReserveBytes = reader.readUint16LE(36);
      folderReserveBytes = reader.readUint8(38);
      const dataReserveBytes = reader.readUint8(39);
      folderTableOffset = CAB_HEADER_BYTE_LENGTH + 4 + headerReserveBytes;
      assertCabRange(CAB_HEADER_BYTE_LENGTH + 4, headerReserveBytes, cabinetBytes, 'reserve header');
      if (dataReserveBytes > 0 && folderCount === 0) {
        throw new CabPreflightError(WARNING_CODES.onepkg.malformedCab, 'This .onepkg declares CFDATA reserve bytes without CAB folders. No output was created.');
      }
    }

    const folderRecordBytes = 8 + folderReserveBytes;
    const folderTableEnd = checkedTableEnd(folderCount, folderRecordBytes, folderTableOffset, cabinetBytes, 'CAB folder table');
    assertCabRange(fileTableOffset, 0, cabinetBytes, 'CAB file table');
    if (fileTableOffset < folderTableEnd) {
      throw new CabPreflightError(WARNING_CODES.onepkg.malformedCab, 'This .onepkg CAB file table overlaps the folder table. No output was created.');
    }

    /** @type {CabCompressionKind[]} */
    const compressionKinds = [];
    for (let index = 0; index < folderCount; index += 1) {
      const offset = folderTableOffset + index * folderRecordBytes;
      const dataOffset = reader.readUint32LE(offset);
      const dataBlockCount = reader.readUint16LE(offset + 4);
      const typeCompress = reader.readUint16LE(offset + 6);
      if (dataOffset > cabinetBytes || (dataBlockCount > 0 && dataOffset === cabinetBytes)) {
        throw new CabPreflightError(WARNING_CODES.onepkg.malformedCab, 'This .onepkg CAB folder points outside the package. No output was created.', 'hard-failure', { folderIndex: index, dataOffset, dataBlockCount });
      }
      compressionKinds.push(compressionKind(typeCompress));
    }

    const allowedCompressionKinds = new Set(
      (Array.isArray(options.allowedCompressionKinds) && options.allowedCompressionKinds.length > 0
        ? options.allowedCompressionKinds
        : ['none', 'mszip'])
        .map((kind) => String(kind).toLowerCase())
    );
    const unsupportedKinds = [...new Set(compressionKinds.filter((kind) => !allowedCompressionKinds.has(kind)))];
    if (unsupportedKinds.length > 0) {
      throw new CabPreflightError(
        WARNING_CODES.onepkg.unsupportedCompression,
        `This .onepkg uses CAB compression not supported for v1.0 inventory: ${unsupportedKinds.join(', ')}. No output was created.`,
        'unsupported',
        { compressionKinds }
      );
    }

    const maxNameBytes = positiveIntegerOption(options.maxEntryNameBytes, DEFAULT_MAX_ENTRY_NAME_BYTES);
    const maxEntryBytes = positiveIntegerOption(options.maxEntryBytes, Number.POSITIVE_INFINITY);
    const maxDeclaredBytes = positiveIntegerOption(options.maxDeclaredBytes, Number.POSITIVE_INFINITY);
    /** @type {CabInventoryEntry[]} */
    const entries = [];
    const seenPaths = new Set();
    let entryOffset = fileTableOffset;
    let declaredBytes = 0;

    for (let index = 0; index < entryCount; index += 1) {
      assertCabRange(entryOffset, 16, cabinetBytes, 'CAB file entry');
      const uncompressedOffset = reader.readUint32LE(entryOffset);
      const size = reader.readUint32LE(entryOffset + 4);
      const folderIndex = reader.readUint16LE(entryOffset + 14);
      if (folderIndex >= folderCount) {
        throw new CabPreflightError(WARNING_CODES.onepkg.invalidFolderReference, 'This .onepkg file entry references an invalid CAB folder. No output was created.', 'hard-failure', { entryIndex: index, folderIndex, folderCount });
      }
      if (uncompressedOffset > MAX_CAB_OFFSET - size) {
        throw new CabPreflightError(WARNING_CODES.onepkg.malformedCab, 'This .onepkg file entry has an invalid uncompressed range. No output was created.', 'hard-failure', { entryIndex: index, uncompressedOffset, size });
      }
      if (size > maxEntryBytes || declaredBytes > maxDeclaredBytes - size) {
        throw new CabPreflightError(WARNING_CODES.onepkg.policyLimitExceeded, 'This .onepkg exceeds the configured declared content limit. No output was created.', 'unsupported', { entryIndex: index, size, declaredBytes, maxEntryBytes, maxDeclaredBytes });
      }
      declaredBytes += size;
      const nameResult = readCabName(reader, bytes, entryOffset + 16, cabinetBytes, maxNameBytes);
      const path = normalizeCabEntryPath(nameResult.name);
      const identity = pathIdentity(path);
      if (seenPaths.has(identity)) {
        throw new CabPreflightError(WARNING_CODES.onepkg.duplicatePath, 'This .onepkg contains duplicate normalized entry paths. No output was created.', 'hard-failure', { path });
      }
      seenPaths.add(identity);
      entries.push({ index, path, kind: entryKind(path), size, uncompressedOffset, folderIndex });
      entryOffset = nameResult.nextOffset;
    }

    return result('success', makeWarning(
      WARNING_CODES.onepkg.inventoryValidated,
      `CAB inventory validated with ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} across ${folderCount} folder(s). Conversion remains unavailable.`,
      'info',
      { entryCount: entries.length, folderCount, compressionKinds, declaredBytes }
    ), entries, compressionKinds);
  } catch (error) {
    if (error instanceof CabPreflightError) {
      return result(error.state, makeWarning(error.code, error.message, 'error', error.context));
    }
    if (error instanceof BinaryReadError) {
      return result('hard-failure', makeWarning(
        WARNING_CODES.onepkg.malformedCab,
        'This .onepkg contains truncated CAB metadata. No output was created.',
        'error',
        { reason: error.code }
      ));
    }
    return result('hard-failure', makeWarning(
      WARNING_CODES.onepkg.malformedCab,
      'This .onepkg could not be validated as a CAB package. No output was created.',
      'error'
    ));
  }
}

export const inventoryOnePackage = preflightOnePackage;