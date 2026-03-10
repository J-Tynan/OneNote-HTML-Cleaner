import { baseNameFromFile } from './importers/sourceKind.js';

const WINDOWS_RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

function looksGuidLike(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return /^[{(]?[0-9a-f]{8}(?:-?[0-9a-f]{4}){3}-?[0-9a-f]{12}[)}]?$/i.test(text);
}

function isGenericSourceStem(value) {
  const normalized = normalizeExportStem(value, { fallback: '' });
  return normalized === ''
    || normalized === 'input'
    || normalized === 'output'
    || normalized === 'document'
    || normalized === 'page'
    || normalized === 'converted-page';
}

function stripHtmlTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ');
}

function decodeCommonHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function normalizeExportStem(value, options = {}) {
  const maxLength = Number.isInteger(options.maxLength) && options.maxLength > 8
    ? options.maxLength
    : 80;

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

export function buildUniqueFilename(stem, extension, takenNames) {
  const safeExt = String(extension || '').replace(/^\./, '').trim().toLowerCase() || 'html';
  const safeStem = normalizeExportStem(stem, { fallback: 'converted-page' });
  const used = takenNames instanceof Set ? takenNames : new Set();

  let suffix = 1;
  let candidate = `${safeStem}.${safeExt}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${safeStem}-${suffix}.${safeExt}`;
  }

  used.add(candidate);
  return candidate;
}

export function buildExportFileName({ entryName = '', outputFormat = 'html', outputContent = '', takenNames } = {}) {
  const format = String(outputFormat || 'html').toLowerCase() === 'markdown' ? 'markdown' : 'html';
  const extension = format === 'markdown' ? 'md' : 'html';
  const stem = buildPreferredExportStem({
    sourceName: entryName,
    content: outputContent,
    format
  });

  const usedNames = takenNames instanceof Map
    ? new Set(takenNames.keys())
    : takenNames instanceof Set
      ? takenNames
      : new Set();

  return buildUniqueFilename(stem, extension, usedNames);
}
