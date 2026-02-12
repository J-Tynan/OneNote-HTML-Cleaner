// src/pipeline/listRepair.js
// Implements three modes: mergeStyled, renumber, smart
// This module operates on a Document and returns logs.

function getLiNodesFromOl(ol) {
  return Array.from(ol.querySelectorAll(':scope > li'));
}

function cleanText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').trim();
}

function hasMeaningfulChild(li) {
  if (!li || typeof li.querySelector !== 'function') return false;
  return Boolean(li.querySelector('img,table,svg,object,embed,iframe,video,audio,canvas'));
}

function removeEmptyListItems(doc) {
  const logs = [];
  const lis = Array.from(doc.querySelectorAll('li'));
  let removed = 0;

  lis.forEach(li => {
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

const LIST_STYLE_TO_TYPE = {
  'upper-alpha': 'A',
  'lower-alpha': 'a',
  'upper-roman': 'I',
  'lower-roman': 'i',
  'decimal': '1'
};

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

function inferListTypes(doc) {
  const logs = [];
  const ols = Array.from(doc.querySelectorAll('ol'));
  let inferred = 0;
  ols.forEach(ol => {
    const t = inferListTypeFromStyle(ol);
    if (t) inferred++;
  });
  if (inferred) logs.push({ step: 'inferListTypes', inferred });
  return logs;
}

const LIST_INDENT_STYLE_KEYS = ['margin-left', 'padding-left', 'text-indent'];
const ONE_NOTE_STYLE_HINT_KEYS = ['mso-list', 'mso-level-number-format', 'mso-level-text'];
const DEFAULT_LIST_PADDING_LEFT = '1.2em';

function parseStyleDeclarations(styleText) {
  return String(styleText || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const idx = part.indexOf(':');
      if (idx === -1) return null;
      const prop = part.slice(0, idx).trim().toLowerCase();
      const value = part.slice(idx + 1).trim();
      if (!prop) return null;
      return { prop, value };
    })
    .filter(Boolean);
}

function serializeStyleDeclarations(entries) {
  return entries.map(({ prop, value }) => `${prop}: ${value}`).join('; ');
}

function removeStyleKeys(styleText, keysToRemove) {
  const removeSet = new Set(keysToRemove.map(k => String(k || '').toLowerCase()));
  const entries = parseStyleDeclarations(styleText).filter(({ prop }) => !removeSet.has(prop));
  return serializeStyleDeclarations(entries);
}

function upsertStyleKey(styleText, key, value) {
  const normalizedKey = String(key || '').toLowerCase();
  const entries = parseStyleDeclarations(styleText).filter(({ prop }) => prop !== normalizedKey);
  entries.push({ prop: normalizedKey, value: String(value || '').trim() });
  return serializeStyleDeclarations(entries);
}

function parseCssLengthToPx(rawValue) {
  const value = String(rawValue || '').trim().toLowerCase();
  const match = value.match(/^(-?\d*\.?\d+)\s*(px|pt|em|rem)?$/i);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  const unit = (match[2] || 'px').toLowerCase();
  if (Number.isNaN(amount)) return null;
  if (unit === 'px') return amount;
  if (unit === 'pt') return amount * (96 / 72);
  if (unit === 'em' || unit === 'rem') return amount * 16;
  return null;
}

function hasOneNoteOrExcessiveIndent(styleText) {
  const entries = parseStyleDeclarations(styleText);
  if (!entries.length) return false;

  for (const { prop, value } of entries) {
    if (ONE_NOTE_STYLE_HINT_KEYS.includes(prop)) return true;
    if (!LIST_INDENT_STYLE_KEYS.includes(prop)) continue;
    const px = parseCssLengthToPx(value);
    if (px !== null && Math.abs(px) >= 24) {
      return true;
    }
  }

  return false;
}

export function normalizeListIndentation(doc, options = {}) {
  const logs = [];
  const lists = Array.from(doc.querySelectorAll('ol,ul'));
  let normalized = 0;
  const paddingLeft = options.listPaddingLeft || DEFAULT_LIST_PADDING_LEFT;

  lists.forEach(list => {
    const ownStyle = list.getAttribute('style') || '';
    const liNodes = Array.from(list.querySelectorAll(':scope > li'));
    const hasLiIndent = liNodes.some(li => hasOneNoteOrExcessiveIndent(li.getAttribute('style') || ''));
    const shouldNormalize = hasOneNoteOrExcessiveIndent(ownStyle) || hasLiIndent;
    if (!shouldNormalize) return;

    let cleanedListStyle = removeStyleKeys(ownStyle, LIST_INDENT_STYLE_KEYS.concat(ONE_NOTE_STYLE_HINT_KEYS));
    cleanedListStyle = upsertStyleKey(cleanedListStyle, 'padding-left', paddingLeft);
    if (cleanedListStyle) {
      list.setAttribute('style', cleanedListStyle);
    } else {
      list.removeAttribute('style');
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
    logs.push({ step: 'normalizeListIndentation', normalized, paddingLeft });
  }

  return logs;
}

export function mergeStyled(doc) {
  const logs = [];
  // For each table cell (<td>), find multiple <ol> children and merge them
  const tds = Array.from(doc.querySelectorAll('td'));
  let mergedCount = 0;
  tds.forEach(td => {
    const ols = Array.from(td.querySelectorAll('ol'));
    if (ols.length <= 1) return;
    // Use attributes from first ol
    const first = ols[0];
    const mergedOl = doc.createElement('ol');
    // copy attributes
    for (const attr of first.attributes) mergedOl.setAttribute(attr.name, attr.value);
    // collect all li children
    ols.forEach(ol => {
      getLiNodesFromOl(ol).forEach(li => {
        mergedOl.appendChild(li.cloneNode(true));
      });
    });
    // remove original ols and append merged
    ols.forEach(ol => ol.remove());
    td.appendChild(mergedOl);
    mergedCount++;
  });
  if (mergedCount) logs.push({ step: 'mergeStyled', mergedCount });
  return logs;
}

export function renumber(doc) {
  const logs = [];
  const ols = Array.from(doc.querySelectorAll('ol'));
  let total = 0;
  ols.forEach(ol => {
    const lis = getLiNodesFromOl(ol);
    let counter = null;
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

export function smartRepair(doc) {
  // A conservative approach: remove broken value attributes and renumber
  const logs = [];
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

    let counter = null;
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

export function fixLists(doc, mode = 'smart', options = {}) {
  const logs = [];
  if (mode === 'mergeStyled') logs.push(...mergeStyled(doc));
  logs.push(...removeEmptyListItems(doc));
  logs.push(...normalizeListIndentation(doc, options));
  logs.push(...inferListTypes(doc));
  if (mode === 'renumber') logs.push(...renumber(doc));
  if (mode === 'smart') logs.push(...smartRepair(doc));
  return logs;
}
