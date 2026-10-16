// @ts-check

import { makeWarning, toWarningMessages, WARNING_CODES } from './warnings.js';
import { ONE_SIGNATURE, parseOneSectionHeader } from './one/section-header.js';

export { ONE_SIGNATURE };

/**
 * @typedef {import('../contracts.js').WarningDetail} WarningDetail
 * @typedef {{ fileName?: string, sourceKind?: string, maxBytes?: number }} OnePreflightOptions
 * @typedef {{ state: 'success' | 'hard-failure' | 'unsupported', canConvert: boolean, warningDetails: WarningDetail[], warnings: string[] }} OnePreflightResult
 */

/**
 * @param {Uint8Array | null | undefined} bytes
 * @returns {boolean}
 */
export function hasOneSignature(bytes) {
  return Boolean(bytes && parseOneSectionHeader(bytes).valid);
}

/**
 * @param {'success' | 'hard-failure' | 'unsupported'} state
 * @param {WarningDetail} warning
 * @returns {OnePreflightResult}
 */
function result(state, warning) {
  const warningDetails = [warning];
  return {
    state,
    canConvert: state === 'success',
    warningDetails,
    warnings: toWarningMessages(warningDetails)
  };
}

/**
 * Validate the cheap, deterministic `.one` gates before native parsing.
 * The size limit is opt-in until benchmark evidence selects a release value.
 *
 * @param {ArrayBuffer | Uint8Array | null | undefined} input
 * @param {OnePreflightOptions} [options={}]
 * @returns {OnePreflightResult}
 */
export function preflightOneSection(input, options = {}) {
  const sourceKind = String(options.sourceKind || 'one').toLowerCase();
  if (sourceKind !== 'one') {
    return result('unsupported', makeWarning(
      WARNING_CODES.one.invalidExtension,
      'Native import expects a .one section file.',
      'error'
    ));
  }

  const bytes = input instanceof Uint8Array
    ? input
    : input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : null;

  if (!bytes || bytes.length === 0) {
    return result('hard-failure', makeWarning(
      WARNING_CODES.one.missingBytes,
      'This .one file is empty or could not be read. No output was created.',
      'error'
    ));
  }

  const maxBytes = Number(options.maxBytes);
  if (Number.isFinite(maxBytes) && maxBytes >= 0 && bytes.length > maxBytes) {
    return result('unsupported', makeWarning(
      WARNING_CODES.one.sizeLimitExceeded,
      `This .one file exceeds the configured browser import limit of ${maxBytes} bytes. No output was created.`,
      'error',
      { actualBytes: bytes.length, maxBytes }
    ));
  }

  const header = parseOneSectionHeader(bytes);
  if (!header.valid) {
    return result('hard-failure', makeWarning(
      WARNING_CODES.one.invalidSignature,
      'This .one file does not have a supported OneNote section signature. No output was created.',
      'error'
    ));
  }

  return result('success', makeWarning(
    WARNING_CODES.one.signatureValidated,
    'OneNote section signature validated.'
  ));
}