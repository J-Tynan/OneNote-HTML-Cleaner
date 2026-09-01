// @ts-check

/**
 * @typedef {import('../contracts.js').MarkdownFlavor} MarkdownFlavor
 * @typedef {{ flavor?: unknown }} MarkdownFlavorOptions
 */

/** @type {MarkdownFlavor} */
const DEFAULT_MARKDOWN_FLAVOR = 'obsidian';

/** @type {readonly MarkdownFlavor[]} */
const SUPPORTED_FLAVORS = Object.freeze([
  'obsidian',
  'commonmark',
  'gfm',
  'markdown-extra'
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeLineBreaks(value) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

/**
 * @param {unknown} markdown
 * @returns {string}
 */
function normalizeTaskListMarkers(markdown) {
  return String(markdown || '').replace(/^(\s*[-*+]\s+)\[(x|X|\s)\]\s+/gm, (match, prefix, marker) => {
    const normalizedMarker = marker && marker.toLowerCase() === 'x' ? 'x' : ' ';
    return `${prefix}[${normalizedMarker}] `;
  });
}

/**
 * @param {unknown} markdown
 * @returns {string}
 */
function normalizeTableDelimiters(markdown) {
  return String(markdown || '').replace(/^\|\s*(:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)*)\s*\|\s*$/gm, (line, cells) => {
    const normalized = String(cells)
      .split('|')
      .map((cell) => cell.trim())
      .map((cell) => {
        if (/^:-{3,}:$/.test(cell)) return ':---:';
        if (/^:-{3,}$/.test(cell)) return ':---';
        if (/^-{3,}:$/.test(cell)) return '---:';
        return '---';
      })
      .join(' | ');
    return `| ${normalized} |`;
  });
}

/**
 * @param {unknown} markdown
 * @returns {string}
 */
function normalizeFencedCodeBlocks(markdown) {
  return String(markdown || '').replace(/^~~~(.*)$/gm, '```$1');
}

/**
 * @param {unknown} markdown
 * @param {MarkdownFlavor} flavor
 * @returns {string}
 */
function applyLineBreakPolicy(markdown, flavor) {
  const normalized = normalizeLineBreaks(markdown);
  if (flavor === 'markdown-extra') {
    return normalized.replace(/\n{3,}/g, '\n\n');
  }
  return normalized;
}

/**
 * @param {unknown} markdown
 * @returns {string}
 */
function applyCommonMarkTaskPolicy(markdown) {
  return String(markdown || '').replace(/^([ \t]*[-*+]\s+)\[(x|\s)\]\s+/gm, (match, prefix, marker) => {
    return `${prefix}\\[${marker}\\] `;
  });
}

/**
 * @param {unknown} markdown
 * @returns {string}
 */
function applyGfmAutolinkPolicy(markdown) {
  return String(markdown || '').replace(/\[(https?:\/\/[^\]\s]+)\]\(\1\)/g, '<$1>');
}

/**
 * @param {unknown} flavor
 * @returns {MarkdownFlavor}
 */
export function normalizeMarkdownFlavor(flavor) {
  const normalized = String(flavor || '').trim().toLowerCase();
  if (!normalized) return DEFAULT_MARKDOWN_FLAVOR;
  if (SUPPORTED_FLAVORS.includes(/** @type {MarkdownFlavor} */ (normalized))) {
    return /** @type {MarkdownFlavor} */ (normalized);
  }
  return DEFAULT_MARKDOWN_FLAVOR;
}

/**
 * @returns {MarkdownFlavor[]}
 */
export function getSupportedMarkdownFlavors() {
  return SUPPORTED_FLAVORS.slice();
}

/**
 * @param {unknown} baseMarkdown
 * @param {MarkdownFlavorOptions} [options]
 * @returns {string}
 */
export function applyMarkdownFlavor(baseMarkdown, options = {}) {
  const flavor = normalizeMarkdownFlavor(options.flavor);
  let output = String(baseMarkdown || '');

  output = normalizeFencedCodeBlocks(output);
  output = normalizeTaskListMarkers(output);
  output = normalizeTableDelimiters(output);
  output = applyLineBreakPolicy(output, flavor);

  if (flavor === 'obsidian') {
    return output;
  }

  if (flavor === 'commonmark') {
    output = applyCommonMarkTaskPolicy(output);
    return output;
  }

  if (flavor === 'gfm') {
    output = applyGfmAutolinkPolicy(output);
    return output;
  }

  if (flavor === 'markdown-extra') {
    return output;
  }

  return output;
}
