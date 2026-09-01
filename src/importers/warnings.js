// DEFERRED: Phase 2 native importer work.
// These warning codes support the deferred `.one` / `.onepkg` importer path.
// They remain defined so post-release native work can keep a stable warning
// surface, but they are not part of the shipped stable conversion flow.

// @ts-check

/**
 * @typedef {import('../contracts.js').WarningDetail} WarningDetail
 * @typedef {import('../contracts.js').WarningSeverity} WarningSeverity
 */

/** @type {{ one: Record<string, string>, onepkg: Record<string, string> }} */
export const WARNING_CODES = {
  one: {
    signatureValidated: 'ONE_SIGNATURE_VALIDATED',
    structuredModelsSummary: 'ONE_STRUCTURED_MODELS_SUMMARY',
    fallbackSemanticSummary: 'ONE_FALLBACK_SEMANTIC_SUMMARY',
    metadataCanonicalizationSummary: 'ONE_METADATA_CANONICALIZATION_SUMMARY',
    embeddedResourceScanSummary: 'ONE_EMBEDDED_RESOURCE_SCAN_SUMMARY',
    placeholderHintsSummary: 'ONE_PLACEHOLDER_HINTS_SUMMARY'
  },
  onepkg: {
    cabParsedSummary: 'ONEPKG_CAB_PARSED_SUMMARY',
    sectionsGeneratedSummary: 'ONEPKG_SECTIONS_GENERATED_SUMMARY',
    deepExtractionSummary: 'ONEPKG_DEEP_EXTRACTION_SUMMARY',
    folderDecodeSummary: 'ONEPKG_FOLDER_DECODE_SUMMARY',
    libarchiveExtractSummary: 'ONEPKG_LIBARCHIVE_EXTRACT_SUMMARY',
    libarchiveExtractFailed: 'ONEPKG_LIBARCHIVE_EXTRACT_FAILED',
    folderDecodeFailedKinds: 'ONEPKG_FOLDER_DECODE_FAILED_KINDS',
    unsupportedCompressionWithFallback: 'ONEPKG_UNSUPPORTED_COMPRESSION_WITH_FALLBACK',
    unsupportedCompressionPlaceholders: 'ONEPKG_UNSUPPORTED_COMPRESSION_PLACEHOLDERS',
    lzxDecoderHint: 'ONEPKG_LZX_DECODER_HINT',
    noFolderDecode: 'ONEPKG_NO_FOLDER_DECODE'
  }
};

/**
 * @param {unknown} code
 * @param {unknown} message
 * @param {WarningSeverity} [severity]
 * @param {Record<string, unknown>} [context]
 * @returns {WarningDetail}
 */
export function makeWarning(code, message, severity = 'info', context = undefined) {
  /** @type {WarningDetail} */
  const warning = {
    code: String(code || '').trim(),
    severity,
    message: String(message || '').trim()
  };

  if (context && typeof context === 'object') {
    warning.context = context;
  }

  return warning;
}

/**
 * @param {unknown} warningDetails
 * @returns {string[]}
 */
export function toWarningMessages(warningDetails) {
  if (!Array.isArray(warningDetails)) return [];
  return warningDetails
    .map((item) => (item && item.message ? String(item.message) : ''))
    .filter((item) => item.length > 0);
}