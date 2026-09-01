// @ts-check
import { baseNameFromFile } from './importers/sourceKind.js';

/**
 * @typedef {'html' | 'markdown'} ExportOutputFormat
 * @typedef {{ fallback?: string, maxLength?: number }} StemOptions
 * @typedef {{ sourceName?: string, content?: string, format?: string }} PreferredStemOptions
 * @typedef {Set<string> | Map<string, unknown>} TakenNames
 * @typedef {{ entryName?: string, outputFormat?: string, outputContent?: string, takenNames?: TakenNames }} BuildExportFileNameOptions
 */

const WINDOWS_RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function looksGuidLike(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return /^[{(]?[0-9a-f]{8}(?:-?[0-9a-f]{4}){3}-?[0-9a-f]{12}[)}]?$/i.test(text);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isGenericSourceStem(value) {
  const normalized = normalizeExportStem(value, { fallback: '' });
  return normalized === ''
    || normalized === 'input'
    || normalized === 'output'
    || normalized === 'document'
    || normalized === 'page'
    || normalized === 'converted-page';
}

/**
 * @param {unknown} html
 * @returns {string}
 */
function stripHtmlTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ');
}

/**
 * @param {unknown} text
 * @returns {string}
 */
function decodeCommonHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeMaxLength(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 8
    ? value
    : 80;
}

  /**
   * @param {unknown} value
   * @param {StemOptions} [options]
   * @returns {string}
   */
export function normalizeExportStem(value, options = {}) {
  const maxLength = normalizeMaxLength(options.maxLength);

  /**
   * @param {unknown} input
   * @returns {string}
   */
  const toSlug = (input) => {
    let stem = String(input || '')
      .normalize('NFKC')
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/[<>:"/\\|?*]/g, ' ')
      .replace(/[^\p{L}\p{N}\s._-]+/gu, ' ')
      .replace(/[\s._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    if (stem.length > maxLength) {
      stem = stem.slice(0, maxLength).replace(/-+$/g, '');
    }

    if (WINDOWS_RESERVED_NAMES.has(stem)) {
      stem = `${stem}-page`;
    }

    return stem;
  };

  const fallbackRaw = String(options.fallback || 'converted-page');
  const fallback = toSlug(fallbackRaw) || 'converted-page';

  let stem = toSlug(value);

  if (!stem) stem = fallback;

  return stem || 'converted-page';
}

/**
 * @param {unknown} content
 * @param {string} [format]
 * @returns {string}
 */
export function extractReadableTitle(content, format = 'html') {
  const text = String(content || '');
  if (!text) return '';

  if (String(format || '').toLowerCase() === 'markdown') {
    const mdHeading = text.match(/^\s*#\s+(.+)$/m);
    return mdHeading ? mdHeading[1].trim() : '';
  }

  const h1Match = text.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    return decodeCommonHtmlEntities(stripHtmlTags(h1Match[1])).replace(/\s+/g, ' ').trim();
  }

  const titleMatch = text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    return decodeCommonHtmlEntities(stripHtmlTags(titleMatch[1])).replace(/\s+/g, ' ').trim();
  }

  return '';
}

/**
 * @param {unknown} value
 * @param {StemOptions} [options]
 * @returns {string}
 */
function sanitizeReadableExportStem(value, options = {}) {
  const maxLength = normalizeMaxLength(options.maxLength);

  const fallback = String(options.fallback || 'Converted Page').trim() || 'Converted Page';

  let stem = String(value || '')
    .normalize('NFKC')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  if (stem.length > maxLength) {
    stem = stem.slice(0, maxLength).trim().replace(/[. ]+$/g, '');
  }

  if (!stem) stem = fallback;

  if (WINDOWS_RESERVED_NAMES.has(stem.toLowerCase())) {
    stem = `${stem} page`;
  }

  return stem || 'Converted Page';
}

/**
 * @param {PreferredStemOptions} [options]
 * @returns {string}
 */
function buildPreferredReadableExportStem({ sourceName = '', content = '', format = 'html' } = {}) {
  const sourceStemRaw = baseNameFromFile(sourceName);
  const sourceStem = sanitizeReadableExportStem(sourceStemRaw, { fallback: 'Converted Page' });
  const title = extractReadableTitle(content, format);
  const titleStem = sanitizeReadableExportStem(title, { fallback: sourceStem });

  if (!title) {
    return looksGuidLike(sourceStemRaw) ? 'Converted Page' : sourceStem;
  }

  if (looksGuidLike(sourceStemRaw) || isGenericSourceStem(sourceStemRaw)) {
    return titleStem;
  }

  return sourceStem;
}

/**
 * @param {unknown} stem
 * @param {unknown} extension
 * @param {Set<string>} [takenNames]
 * @returns {string}
 */
function buildUniqueReadableFilename(stem, extension, takenNames) {
  const safeExt = String(extension || '').replace(/^\./, '').trim().toLowerCase() || 'html';
  const safeStem = sanitizeReadableExportStem(stem, { fallback: 'Converted Page' });
  const used = takenNames instanceof Set ? takenNames : /** @type {Set<string>} */ (new Set());
  const usedKeys = new Set(Array.from(used, (name) => String(name || '').toLowerCase()));

  let suffix = 1;
  let candidate = `${safeStem}.${safeExt}`;
  while (usedKeys.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${safeStem}-${suffix}.${safeExt}`;
  }

  used.add(candidate);
  return candidate;
}

/**
 * @param {PreferredStemOptions} [options]
 * @returns {string}
 */
export function buildPreferredExportStem({ sourceName = '', content = '', format = 'html' } = {}) {
  const sourceStemRaw = baseNameFromFile(sourceName);
  const sourceStem = normalizeExportStem(sourceStemRaw, { fallback: 'converted-page' });
  const title = extractReadableTitle(content, format);
  const titleStem = normalizeExportStem(title, { fallback: sourceStem });

  if (!title) {
    return looksGuidLike(sourceStemRaw) ? 'converted-page' : sourceStem;
  }

  if (looksGuidLike(sourceStemRaw) || isGenericSourceStem(sourceStemRaw)) {
    return titleStem;
  }

  if (!looksGuidLike(sourceStemRaw)) {
    return sourceStem;
  }

  return title ? titleStem : 'converted-page';
}

/**
 * @param {unknown} stem
 * @param {unknown} extension
 * @param {Set<string>} [takenNames]
 * @returns {string}
 */
export function buildUniqueFilename(stem, extension, takenNames) {
  const safeExt = String(extension || '').replace(/^\./, '').trim().toLowerCase() || 'html';
  const safeStem = normalizeExportStem(stem, { fallback: 'converted-page' });
  const used = takenNames instanceof Set ? takenNames : /** @type {Set<string>} */ (new Set());

  let suffix = 1;
  let candidate = `${safeStem}.${safeExt}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${safeStem}-${suffix}.${safeExt}`;
  }

  used.add(candidate);
  return candidate;
}

/**
 * @param {BuildExportFileNameOptions} [options]
 * @returns {string}
 */
export function buildExportFileName({ entryName = '', outputFormat = 'html', outputContent = '', takenNames } = {}) {
  const format = String(outputFormat || 'html').toLowerCase() === 'markdown' ? 'markdown' : 'html';
  const extension = format === 'markdown' ? 'md' : 'html';
  const stem = buildPreferredReadableExportStem({
    sourceName: entryName,
    content: outputContent,
    format
  });

  const usedNames = takenNames instanceof Map
    ? new Set(takenNames.keys())
    : takenNames instanceof Set
      ? takenNames
      : new Set();

  return buildUniqueReadableFilename(stem, extension, usedNames);
}
