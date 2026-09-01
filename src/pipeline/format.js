// @ts-check

// src/pipeline/format.js
const SENSITIVE_BLOCK_RE = /<(pre|script|style|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * @typedef {{ step: 'format', details: string }} FormatLogEntry
 */

/**
 * @param {unknown} html
 * @returns {string}
 */
export function normalizeWhitespace(html) {
  let out = String(html || '');
  out = out.replace(/\r\n?/g, '\n');
  out = out.replace(/\u00a0/g, ' ');
  out = out.replace(/&nbsp;/gi, ' ');

  const protectedBlocks = /** @type {string[]} */ ([]);
  out = out.replace(SENSITIVE_BLOCK_RE, (match) => {
    const token = `__ONC_FORMAT_BLOCK_${protectedBlocks.length}__`;
    protectedBlocks.push(match);
    return token;
  });

  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');

  out = out.replace(/\n{3,}/g, '\n\n');

  out = out.replace(/__ONC_FORMAT_BLOCK_(\d+)__/g, (_, index) => {
    const value = protectedBlocks[Number(index)];
    return typeof value === 'string' ? value : '';
  });

  return out;
}

/**
 * @param {unknown} doc
 * @param {Record<string, unknown>} [options={}]
 * @returns {FormatLogEntry[]}
 */
export function formatDocument(doc, options = {}) {
  void doc;
  void options;
  return [{ step: 'format', details: 'post-serialization whitespace cleanup enabled' }];
}
