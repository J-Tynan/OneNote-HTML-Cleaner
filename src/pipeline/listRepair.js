// @ts-check

// src/pipeline/listRepair.js
// Implements three modes: mergeStyled, renumber, smart
// This module operates on a Document and returns logs.

import {
  cssLengthToPx,
  parseStyleDeclarationEntries,
  serializeStyleDeclarationEntries
} from './styleUtils.js';

/**
 * @typedef {{ prop: string, value: string }} StyleDeclarationEntry
 * @typedef {{ name: string, value: string }} DomAttribute
 * @typedef {{
 *   tagName: string,
 *   textContent?: string | null,
 *   parentElement?: DomElement | null,
 *   attributes?: Iterable<DomAttribute> | ArrayLike<DomAttribute>,
 *   classList?: { add: (className: string) => void },
 *   getAttribute: (name: string) => string | null,
 *   setAttribute: (name: string, value: string) => void,
 *   removeAttribute: (name: string) => void,
 *   hasAttribute: (name: string) => boolean,
 *   querySelector: (selector: string) => DomElement | null,
 *   querySelectorAll: (selector: string) => ArrayLike<DomElement>,
 *   closest: (selector: string) => DomElement | null,
 *   appendChild: (child: DomElement) => void,
 *   remove: () => void
 * }} DomElement
 * @typedef {{ querySelectorAll: (selector: string) => ArrayLike<DomElement>, createElement: (tagName: string) => DomElement }} DomDocument
 * @typedef {{ listPaddingLeft?: string, listMarginLeft?: string, normalizeAllListIndent?: boolean }} NormalizeListIndentationOptions
 * @typedef {'mergeStyled' | 'renumber' | 'smart'} ListRepairMode
 * @typedef {{ step: 'removeEmptyListItems', removed: number }} RemoveEmptyListItemsLogEntry
 * @typedef {{ step: 'inferListTypes', inferred: number }} InferListTypesLogEntry
 * @typedef {{ step: 'normalizeCueColumnLists', updated: number }} NormalizeCueColumnListsLogEntry
 * @typedef {{ step: 'normalizeListIndentation', normalized: number, marginLeft: string, paddingLeft: string, normalizeAll: boolean }} NormalizeListIndentationLogEntry
 * @typedef {{ step: 'mergeStyled', mergedCount: number }} MergeStyledLogEntry
 * @typedef {{ step: 'renumber', total: number }} RenumberLogEntry
 * @typedef {{ step: 'smartRepair', cleaned: number } | { step: 'smartRepair', filled: number }} SmartRepairLogEntry
 * @typedef {RemoveEmptyListItemsLogEntry | InferListTypesLogEntry | NormalizeCueColumnListsLogEntry | NormalizeListIndentationLogEntry | MergeStyledLogEntry | RenumberLogEntry | SmartRepairLogEntry} ListRepairLogEntry
 */

/**
 * @param {DomElement} ol
 * @returns {DomElement[]}
 */
function getLiNodesFromOl(ol) {
  return Array.from(ol.querySelectorAll(':scope > li'));
}

/**
 * @param {DomElement} td
 * @returns {DomElement[]}
 */
function getTopLevelOlNodesFromTd(td) {
  return Array.from(td.querySelectorAll('ol')).filter((ol) => {
    const ancestorList = ol.parentElement ? ol.parentElement.closest('ol,ul') : null;
    return !ancestorList;
  });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').trim();
}

/**
 * @param {DomElement | null | undefined} li
 * @returns {boolean}
 */
function hasMeaningfulChild(li) {
  if (!li || typeof li.querySelector !== 'function') return false;
  return Boolean(li.querySelector('img,table,svg,object,embed,iframe,video,audio,canvas'));
}

/**
 * @param {DomDocument} doc
 * @returns {RemoveEmptyListItemsLogEntry[]}
 */
function removeEmptyListItems(doc) {
  const logs = /** @type {RemoveEmptyListItemsLogEntry[]} */ ([]);
  const lis = Array.from(doc.querySelectorAll('li'));
  let removed = 0;

  lis.forEach(li => {
    const parentList = li.closest('ol,ul');
    const parentTag = parentList ? parentList.tagName.toLowerCase() : '';
    if (parentTag !== 'ol') {
      return;
    }
    const text = cleanText(li.textContent);
    const value = li.getAttribute('value');
    const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
    if (text.length === 0 && !hasMeaningfulChild(li) && !hasValue) {
      li.remove();
      removed++;
    }
  });

  if (removed) logs.push({ step: 'removeEmptyListItems', removed });
  return logs;
}

/** @type {Record<string, string>} */
const LIST_STYLE_TO_TYPE = {
  'upper-alpha': 'A',
  'lower-alpha': 'a',
  'upper-roman': 'I',
  'lower-roman': 'i',
  'decimal': '1'
};

/**
 * @param {DomElement | null | undefined} ol
 * @returns {string | null}
 */
function inferListTypeFromStyle(ol) {
  if (!ol || ol.hasAttribute('type')) return null;
  const style = (ol.getAttribute('style') || '').toLowerCase();
  const match = style.match(/list-style-type\s*:\s*([^;]+)/i);
  if (match) {
    const val = match[1].trim().toLowerCase();
    if (LIST_STYLE_TO_TYPE[val]) {
      ol.setAttribute('type', LIST_STYLE_TO_TYPE[val]);
      return LIST_STYLE_TO_TYPE[val];
    }
  }

  const lis = getLiNodesFromOl(ol);
  for (const li of lis) {
    const liStyle = (li.getAttribute('style') || '').toLowerCase();
    const m = liStyle.match(/list-style-type\s*:\s*([^;]+)/i);
    if (m) {
      const v = m[1].trim().toLowerCase();
      if (LIST_STYLE_TO_TYPE[v]) {
        ol.setAttribute('type', LIST_STYLE_TO_TYPE[v]);
        return LIST_STYLE_TO_TYPE[v];
      }
    }
  }

  return null;
}

/**
 * @param {DomDocument} doc
 * @returns {InferListTypesLogEntry[]}
 */
function inferListTypes(doc) {
  const logs = /** @type {InferListTypesLogEntry[]} */ ([]);
  const ols = Array.from(doc.querySelectorAll('ol'));
  let inferred = 0;
  ols.forEach(ol => {
    const t = inferListTypeFromStyle(ol);
    if (t) inferred++;
  });
  if (inferred) logs.push({ step: 'inferListTypes', inferred });
  return logs;
}

/** @type {readonly string[]} */
const LIST_INDENT_STYLE_KEYS = ['margin-left', 'padding-left', 'padding-inline-start', 'text-indent'];
/** @type {readonly string[]} */
const ONE_NOTE_STYLE_HINT_KEYS = ['mso-list', 'mso-level-number-format', 'mso-level-text'];
const DEFAULT_LIST_PADDING_LEFT = '1.2em';
const DEFAULT_LIST_MARGIN_LEFT = '0.35em';

/**
 * @param {unknown} styleText
 * @param {readonly string[]} keysToRemove
 * @returns {string}
 */
function removeStyleKeys(styleText, keysToRemove) {
  const removeSet = new Set(keysToRemove.map(k => String(k || '').toLowerCase()));
  const entries = parseStyleDeclarationEntries(styleText).filter(({ prop }) => !removeSet.has(prop));
  return serializeStyleDeclarationEntries(entries);
}

/**
 * @param {unknown} styleText
 * @param {unknown} key
 * @param {unknown} value
 * @returns {string}
 */
function upsertStyleKey(styleText, key, value) {
  const normalizedKey = String(key || '').toLowerCase();
  const entries = parseStyleDeclarationEntries(styleText).filter(({ prop }) => prop !== normalizedKey);
  entries.push({ prop: normalizedKey, value: String(value || '').trim() });
  return serializeStyleDeclarationEntries(entries);
}

/**
 * @param {unknown} styleText
 * @returns {boolean}
 */
function hasOneNoteOrExcessiveIndent(styleText) {
  const entries = parseStyleDeclarationEntries(styleText);
  if (!entries.length) return false;

  for (const { prop, value } of entries) {
    if (ONE_NOTE_STYLE_HINT_KEYS.includes(prop)) return true;
    if (!LIST_INDENT_STYLE_KEYS.includes(prop)) continue;
    const px = cssLengthToPx(value);
    if (px !== null && Math.abs(px) >= 24) {
      return true;
    }
  }

  return false;
}

/**
 * @param {DomElement | null | undefined} el
 * @param {readonly string[] | null | undefined} classNames
 * @returns {void}
 */
function addClasses(el, classNames) {
  if (!el || !classNames || !classNames.length) return;
  const classList = el.classList;
  if (classList) {
    classNames.forEach(name => classList.add(name));
    return;
  }

  const set = new Set(String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean));
  classNames.forEach(name => set.add(name));
  el.setAttribute('class', Array.from(set).join(' '));
}

/**
 * @param {DomDocument} doc
 * @returns {NormalizeCueColumnListsLogEntry[]}
 */
function normalizeCueColumnLists(doc) {
  const logs = /** @type {NormalizeCueColumnListsLogEntry[]} */ ([]);
  const cueLists = Array.from(doc.querySelectorAll(
    'td[data-onc-col-role="leading"] ol, td[data-onc-col-role="leading"] ul, td.cues ol, td.cues ul'
  ));
  let updated = 0;

  cueLists.forEach(list => {
    if (list.tagName.toLowerCase() === 'ol') {
      addClasses(list, ['list-decimal', 'list-outside', 'pl-5']);
    } else {
      addClasses(list, ['list-disc', 'list-outside', 'pl-5']);
    }
    updated += 1;
  });

  if (updated) logs.push({ step: 'normalizeCueColumnLists', updated });
  return logs;
}

/**
 * @param {DomDocument} doc
 * @param {NormalizeListIndentationOptions} [options={}]
 * @returns {NormalizeListIndentationLogEntry[]}
 */
export function normalizeListIndentation(doc, options = {}) {
  const logs = /** @type {NormalizeListIndentationLogEntry[]} */ ([]);
  const lists = Array.from(doc.querySelectorAll('ol,ul'));
  let normalized = 0;
  const paddingLeft = options.listPaddingLeft || DEFAULT_LIST_PADDING_LEFT;
  const marginLeft = options.listMarginLeft || DEFAULT_LIST_MARGIN_LEFT;
  const normalizeAll = options.normalizeAllListIndent === true;

  lists.forEach(list => {
    const ownStyle = list.getAttribute('style') || '';
    const liNodes = Array.from(list.querySelectorAll(':scope > li'));
    const hasLiIndent = liNodes.some(li => hasOneNoteOrExcessiveIndent(li.getAttribute('style') || ''));
    const shouldNormalize = normalizeAll || hasOneNoteOrExcessiveIndent(ownStyle) || hasLiIndent;
    if (!shouldNormalize) return;

    let cleanedListStyle = removeStyleKeys(ownStyle, LIST_INDENT_STYLE_KEYS.concat(ONE_NOTE_STYLE_HINT_KEYS));
    cleanedListStyle = upsertStyleKey(cleanedListStyle, 'margin-left', marginLeft);
    cleanedListStyle = upsertStyleKey(cleanedListStyle, 'padding-left', paddingLeft);
    cleanedListStyle = upsertStyleKey(cleanedListStyle, 'padding-inline-start', paddingLeft);
    if (cleanedListStyle) {
      list.setAttribute('style', cleanedListStyle);
    } else {
      list.removeAttribute('style');
    }

    if (list.tagName.toLowerCase() === 'ol') {
      addClasses(list, ['list-decimal', 'list-outside']);
    } else {
      addClasses(list, ['list-disc', 'list-outside']);
    }

    liNodes.forEach(li => {
      const liStyle = li.getAttribute('style') || '';
      const cleanedLiStyle = removeStyleKeys(liStyle, LIST_INDENT_STYLE_KEYS.concat(ONE_NOTE_STYLE_HINT_KEYS));
      if (cleanedLiStyle) {
        li.setAttribute('style', cleanedLiStyle);
      } else if (li.hasAttribute('style')) {
        li.removeAttribute('style');
      }
    });

    normalized += 1;
  });

  if (normalized) {
    logs.push({ step: 'normalizeListIndentation', normalized, marginLeft, paddingLeft, normalizeAll });
  }

  return logs;
}

/**
 * @param {DomDocument} doc
 * @returns {MergeStyledLogEntry[]}
 */
export function mergeStyled(doc) {
  const logs = /** @type {MergeStyledLogEntry[]} */ ([]);
  // For each table cell (<td>), find multiple <ol> children and merge them
  const tds = Array.from(doc.querySelectorAll('td'));
  let mergedCount = 0;
  tds.forEach(td => {
    const ols = getTopLevelOlNodesFromTd(td);
    if (ols.length <= 1) return;
    // Use attributes from first ol
    const first = ols[0];
    const mergedOl = doc.createElement('ol');
    // copy attributes
    Array.from(first.attributes || []).forEach((attr) => mergedOl.setAttribute(attr.name, attr.value));
    // collect all li children (moving rather than cloning)
    ols.forEach(ol => {
      const lis = getLiNodesFromOl(ol).slice(); // copy to avoid live list issues
      lis.forEach(li => {
        mergedOl.appendChild(li); // moves node from original ol
      });
    });
    // remove original ols (now likely empty) and append merged
    ols.forEach(ol => ol.remove());
    td.appendChild(mergedOl);
    mergedCount++;
  });
  if (mergedCount) logs.push({ step: 'mergeStyled', mergedCount });
  return logs;
}

/**
 * @param {DomDocument} doc
 * @returns {RenumberLogEntry[]}
 */
export function renumber(doc) {
  const logs = /** @type {RenumberLogEntry[]} */ ([]);
  const ols = Array.from(doc.querySelectorAll('ol'));
  let total = 0;
  ols.forEach(ol => {
    const lis = getLiNodesFromOl(ol);
    let counter = /** @type {number | null} */ (null);
    lis.forEach(li => {
      const v = li.getAttribute('value');
      if (v && /^\d+$/.test(v)) {
        counter = parseInt(v, 10);
        return;
      }
      if (counter === null) {
        counter = 1;
      } else {
        counter += 1;
      }
      li.setAttribute('value', String(counter));
      total += 1;
    });
  });
  if (total) logs.push({ step: 'renumber', total });
  return logs;
}

/**
 * @param {DomDocument} doc
 * @returns {SmartRepairLogEntry[]}
 */
export function smartRepair(doc) {
  // A conservative approach: remove broken value attributes and renumber
  const logs = /** @type {SmartRepairLogEntry[]} */ ([]);
  const ols = Array.from(doc.querySelectorAll('ol'));
  let cleaned = 0;
  let filled = 0;

  ols.forEach(ol => {
    const lis = getLiNodesFromOl(ol);
    lis.forEach(li => {
      const v = li.getAttribute('value');
      if (v && !/^\d+$/.test(v)) {
        li.removeAttribute('value');
        cleaned += 1;
      }
    });

    let counter = /** @type {number | null} */ (null);
    lis.forEach(li => {
      const v = li.getAttribute('value');
      if (v && /^\d+$/.test(v)) {
        counter = parseInt(v, 10);
        return;
      }
      if (counter === null) {
        counter = 1;
      } else {
        counter += 1;
      }
      li.setAttribute('value', String(counter));
      filled += 1;
    });
  });

  if (cleaned) logs.push({ step: 'smartRepair', cleaned });
  if (filled) logs.push({ step: 'smartRepair', filled });
  return logs;
}

/**
 * @param {DomDocument} doc
 * @param {ListRepairMode} [mode='smart']
 * @param {NormalizeListIndentationOptions} [options={}]
 * @returns {ListRepairLogEntry[]}
 */
export function fixLists(doc, mode = 'smart', options = {}) {
  const logs = /** @type {ListRepairLogEntry[]} */ ([]);
  if (mode === 'mergeStyled') logs.push(...mergeStyled(doc));
  logs.push(...removeEmptyListItems(doc));
  logs.push(...normalizeListIndentation(doc, options));
  logs.push(...normalizeCueColumnLists(doc));
  logs.push(...inferListTypes(doc));
  if (mode === 'renumber') logs.push(...renumber(doc));
  if (mode === 'smart') logs.push(...smartRepair(doc));
  return logs;
}
