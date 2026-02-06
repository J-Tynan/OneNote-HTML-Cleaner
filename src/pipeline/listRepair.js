// src/pipeline/listRepair.js
// Implements three modes: mergeStyled, renumber, smart
// This module operates on a Document and returns logs.

function getLiNodesFromOl(ol) {
  return Array.from(ol.querySelectorAll(':scope > li'));
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
    let counter = 0;
    lis.forEach(li => {
      counter++;
      li.setAttribute('value', String(counter));
      total++;
    });
  });
  if (total) logs.push({ step: 'renumber', total });
  return logs;
}

export function smartRepair(doc) {
  // A conservative approach: remove broken value attributes and renumber
  const logs = [];
  const lis = Array.from(doc.querySelectorAll('li'));
  let cleaned = 0;
  lis.forEach(li => {
    const v = li.getAttribute('value');
    if (v && !/^\d+$/.test(v)) {
      li.removeAttribute('value');
      cleaned++;
    }
  });
  if (cleaned) logs.push({ step: 'smartRepair', cleaned });
  // then renumber
  logs.push(...renumber(doc));
  return logs;
}

export function fixLists(doc, mode = 'smart') {
  const logs = [];
  if (mode === 'mergeStyled') logs.push(...mergeStyled(doc));
  if (mode === 'renumber') logs.push(...renumber(doc));
  if (mode === 'smart') logs.push(...smartRepair(doc));
  return logs;
}
