// @ts-check

/**
 * @typedef {{ maxReadBytes?: number }} BinaryReaderOptions
 */

export class BinaryReadError extends Error {
  /**
   * @param {'invalid-input' | 'invalid-range' | 'read-budget-exceeded' | 'invalid-utf16-length'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'BinaryReadError';
    this.code = code;
  }
}

/**
 * Bounded little-endian reader for native OneNote parsing. It intentionally
 * exposes no format-specific offsets; record parsers must validate those.
 */
export class BinaryReader {
  /**
   * @param {ArrayBuffer | Uint8Array} input
   * @param {BinaryReaderOptions} [options={}]
   */
  constructor(input, options = {}) {
    if (input instanceof Uint8Array) {
      this.bytes = input;
    } else if (input instanceof ArrayBuffer) {
      this.bytes = new Uint8Array(input);
    } else {
      throw new BinaryReadError('invalid-input', 'Binary reader requires an ArrayBuffer or Uint8Array.');
    }

    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    const configuredBudget = Number(options.maxReadBytes);
    this.maxReadBytes = Number.isSafeInteger(configuredBudget) && configuredBudget >= 0
      ? configuredBudget
      : this.bytes.byteLength;
    this.readBytes = 0;
  }

  get length() {
    return this.bytes.byteLength;
  }

  /** @param {number} offset @param {number} length */
  assertRange(offset, length) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset > this.length || length > this.length - offset) {
      throw new BinaryReadError('invalid-range', `Requested range ${offset}+${length} is outside the ${this.length}-byte buffer.`);
    }
  }

  /** @param {number} length */
  reserve(length) {
    if (length > this.maxReadBytes - this.readBytes) {
      throw new BinaryReadError('read-budget-exceeded', `Read budget of ${this.maxReadBytes} bytes was exceeded.`);
    }
    this.readBytes += length;
  }

  /** @param {number} offset @param {number} length */
  readSlice(offset, length) {
    this.assertRange(offset, length);
    this.reserve(length);
    return this.bytes.slice(offset, offset + length);
  }

  /** @param {number} offset */
  readUint8(offset) {
    this.assertRange(offset, 1);
    this.reserve(1);
    return this.view.getUint8(offset);
  }

  /** @param {number} offset */
  readUint16LE(offset) {
    this.assertRange(offset, 2);
    this.reserve(2);
    return this.view.getUint16(offset, true);
  }

  /** @param {number} offset */
  readUint32LE(offset) {
    this.assertRange(offset, 4);
    this.reserve(4);
    return this.view.getUint32(offset, true);
  }

  /** @param {number} offset */
  readUint64LE(offset) {
    this.assertRange(offset, 8);
    this.reserve(8);
    return this.view.getBigUint64(offset, true);
  }

  /** @param {number} offset */
  readGuid(offset) {
    const bytes = this.readSlice(offset, 16);
    const toHex = (start, end) => Array.from(bytes.slice(start, end), (value) => value.toString(16).padStart(2, '0')).join('');
    return `${toHex(3, 4)}${toHex(2, 3)}${toHex(1, 2)}${toHex(0, 1)}-${toHex(5, 6)}${toHex(4, 5)}-${toHex(7, 8)}${toHex(6, 7)}-${toHex(8, 10)}-${toHex(10, 16)}`;
  }

  /** @param {number} offset @param {number} byteLength */
  readUtf16LE(offset, byteLength) {
    if (!Number.isSafeInteger(byteLength) || byteLength % 2 !== 0) {
      throw new BinaryReadError('invalid-utf16-length', 'UTF-16LE input must use an even byte length.');
    }
    return new TextDecoder('utf-16le', { fatal: true }).decode(this.readSlice(offset, byteLength));
  }
}