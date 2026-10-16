// @ts-check

import { runPipeline } from '../../pipeline/pipeline.js';

/**
 * @typedef {{ kind: 'paragraph', text: string }} NativeParagraphBlock
 * @typedef {{ kind: 'list', style: 'ordered' | 'unordered', items: string[] }} NativeListBlock
 * @typedef {{ kind: 'table', header?: string[] | null, rows: string[][] }} NativeTableBlock
 * @typedef {{ kind: 'image', source: string, alt?: string, caption?: string }} NativeImageBlock
 * @typedef {NativeParagraphBlock | NativeListBlock | NativeTableBlock | NativeImageBlock} NativePageBlock
 * @typedef {{ title?: string, lang?: string, blocks: NativePageBlock[] }} NativePageRenderModel
 * @typedef {import('../../contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {import('../../contracts.js').PipelineLogEntry} PipelineLogEntry
 * @typedef {import('../../contracts.js').OutputAsset} OutputAsset
 */

const INVALID_CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export class NativeRenderError extends Error {
  /**
   * @param {'invalid-model' | 'invalid-text' | 'invalid-resource-path' | 'unsupported-block'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'NativeRenderError';
    this.code = code;
  }
}

/** @param {unknown} value @param {string} field */
function requireText(value, field) {
  if (typeof value !== 'string') {
    throw new NativeRenderError('invalid-model', `${field} must be a string.`);
  }
  if (INVALID_CONTROL_CHARACTER.test(value)) {
    throw new NativeRenderError('invalid-text', `${field} contains an unsupported control character.`);
  }
  return value;
}

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @param {unknown} source */
function requireRelativeResourcePath(source) {
  const value = requireText(source, 'image source').trim();
  if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || /^[\\/]/.test(value) || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value)) {
    throw new NativeRenderError('invalid-resource-path', 'Image source must be a safe relative resource path.');
  }
  return value;
}

/** @param {unknown} values @param {string} field */
function requireTextArray(values, field) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new NativeRenderError('invalid-model', `${field} must be a non-empty string array.`);
  }
  return values.map((value, index) => requireText(value, `${field}[${index}]`));
}

/** @param {NativePageBlock} block */
function renderBlock(block) {
  if (!block || typeof block !== 'object') {
    throw new NativeRenderError('invalid-model', 'Page blocks must be objects.');
  }

  if (block.kind === 'paragraph') {
    return `<p>${escapeHtml(requireText(block.text, 'paragraph text'))}</p>`;
  }

  if (block.kind === 'list') {
    const items = requireTextArray(block.items, 'list items');
    if (block.style !== 'ordered' && block.style !== 'unordered') {
      throw new NativeRenderError('invalid-model', 'List style must be ordered or unordered.');
    }
    const tagName = block.style === 'ordered' ? 'ol' : 'ul';
    return `<${tagName}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tagName}>`;
  }

  if (block.kind === 'table') {
    const rows = Array.isArray(block.rows) ? block.rows : [];
    if (rows.length === 0) {
      throw new NativeRenderError('invalid-model', 'Table rows must be a non-empty array.');
    }
    const header = block.header == null ? null : requireTextArray(block.header, 'table header');
    const columnCount = header ? header.length : Array.isArray(rows[0]) ? rows[0].length : 0;
    if (columnCount === 0) {
      throw new NativeRenderError('invalid-model', 'Table rows must contain at least one cell.');
    }
    const renderedRows = rows.map((row, rowIndex) => {
      if (!Array.isArray(row) || row.length !== columnCount) {
        throw new NativeRenderError('invalid-model', 'Table rows must form a rectangle.');
      }
      return `<tr>${row.map((cell, cellIndex) => `<td>${escapeHtml(requireText(cell, `table rows[${rowIndex}][${cellIndex}]`))}</td>`).join('')}</tr>`;
    }).join('');
    const headerHtml = header
      ? `<thead><tr>${header.map((cell, index) => `<th scope="col">${escapeHtml(requireText(cell, `table header[${index}]`))}</th>`).join('')}</tr></thead>`
      : '';
    return `<table>${headerHtml}<tbody>${renderedRows}</tbody></table>`;
  }

  if (block.kind === 'image') {
    const source = requireRelativeResourcePath(block.source);
    const alt = block.alt == null ? 'Image' : requireText(block.alt, 'image alt');
    const imageHtml = `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}">`;
    if (block.caption == null || block.caption === '') {
      return `<figure>${imageHtml}</figure>`;
    }
    return `<figure>${imageHtml}<figcaption>${escapeHtml(requireText(block.caption, 'image caption'))}</figcaption></figure>`;
  }

  throw new NativeRenderError('unsupported-block', `Unsupported native page block kind: ${String(block.kind)}.`);
}

/**
 * Serialize direct, already-associated native content without inferring any
 * structure from strings, delimiters, or raw resource signatures.
 *
 * @param {NativePageRenderModel} page
 * @returns {string}
 */
export function renderNativePageHtml(page) {
  if (!page || typeof page !== 'object' || !Array.isArray(page.blocks)) {
    throw new NativeRenderError('invalid-model', 'A native page render model requires a blocks array.');
  }
  const title = page.title == null ? 'Untitled Page' : requireText(page.title, 'page title');
  const lang = page.lang == null ? 'en' : requireText(page.lang, 'page language').trim();
  if (!lang) {
    throw new NativeRenderError('invalid-model', 'Page language must not be empty.');
  }
  const blocks = page.blocks.map(renderBlock).join('');
  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1>${blocks}</main></body></html>`;
}

/**
 * @param {NativePageRenderModel} page
 * @param {PipelineConfigInput} [config={}]
 * @returns {Promise<{ html: string, logs: PipelineLogEntry[], assets: OutputAsset[] }>}
 */
export async function renderNativePageWithPipeline(page, config = {}) {
  const rawHtml = renderNativePageHtml(page);
  const result = await runPipeline(rawHtml, {
    ...config,
    SourceKind: config.SourceKind || 'one',
    sourceKind: config.sourceKind || 'one',
    defaultTitle: config.defaultTitle || page.title || 'Untitled Page',
    fileName: config.fileName || page.title || 'Untitled Page'
  });
  return {
    html: result.output,
    logs: result.logs,
    assets: result.assets
  };
}