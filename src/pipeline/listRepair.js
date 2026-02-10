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

export function fixLists(doc, mode = 'smart') {
  const logs = [];
  if (mode === 'mergeStyled') logs.push(...mergeStyled(doc));
  logs.push(...removeEmptyListItems(doc));
  logs.push(...inferListTypes(doc));
  if (mode === 'renumber') logs.push(...renumber(doc));
  if (mode === 'smart') logs.push(...smartRepair(doc));
  return logs;
}
