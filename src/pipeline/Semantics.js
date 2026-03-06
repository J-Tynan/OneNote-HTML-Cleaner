function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function setDataAttr(el, name, value) {
  if (!el || !name) return;
  if (value === null || value === undefined || value === '') return;
  el.setAttribute(name, String(value));
}

function removeClassNames(el, names) {
  if (!el || !Array.isArray(names) || !names.length) return 0;
  if (!el.classList) return 0;
  let removed = 0;
  names.forEach(name => {
    if (el.classList.contains(name)) {
      el.classList.remove(name);
      removed += 1;
    }
  });
  if (!el.classList.length) {
    el.removeAttribute('class');
  }
  return removed;
}

function getRowCells(row) {
  return Array.from(row.querySelectorAll(':scope > th, :scope > td'));
}

function getTableRows(table) {
  const bodyRows = Array.from(table.querySelectorAll(':scope > tbody > tr'));
  if (bodyRows.length) return bodyRows;
  return Array.from(table.querySelectorAll(':scope > tr'));
}

function detectHeaderIndexes(cells) {
  let cueIndex = -1;
  let notesIndex = -1;

  cells.forEach((cell, index) => {
    const text = normalizeText(cell.textContent);
    if (cueIndex === -1 && /\bcue(s)?\b/.test(text)) cueIndex = index;
    if (notesIndex === -1 && /\bnote(s)?\b/.test(text)) notesIndex = index;
  });

  return { cueIndex, notesIndex };
}

function detectLegacyColumnIndexes(rows) {
  let cueIndex = -1;
  let notesIndex = -1;

  rows.forEach(row => {
    const cells = getRowCells(row);
    cells.forEach((cell, index) => {
      if (!cell.classList) return;
      if (cueIndex === -1 && cell.classList.contains('cues')) cueIndex = index;
      if (notesIndex === -1 && cell.classList.contains('notes')) notesIndex = index;
    });
  });

  return { cueIndex, notesIndex };
}

function classifyTable(table) {
  const rows = getTableRows(table);
  if (!rows.length) return null;

  const firstCells = getRowCells(rows[0]);
  if (firstCells.length < 2) return null;

  const legacy = detectLegacyColumnIndexes(rows);
  const detected = detectHeaderIndexes(firstCells);
  const hasDetectedHeaders =
    legacy.cueIndex !== -1 ||
    legacy.notesIndex !== -1 ||
    detected.cueIndex !== -1 ||
    detected.notesIndex !== -1;

  const cueIndex =
    legacy.cueIndex !== -1
      ? legacy.cueIndex
      : (detected.cueIndex !== -1 ? detected.cueIndex : 0);
  const notesIndex =
    legacy.notesIndex !== -1
      ? legacy.notesIndex
      : (detected.notesIndex !== -1 ? detected.notesIndex : 1);

  if (cueIndex === notesIndex) return null;

  return {
    cueIndex,
    notesIndex,
    hasDetectedHeaders,
    rows
  };
}

export function annotateTableSemantics(doc, options = {}) {
  const logs = [];
  const tables = Array.from(doc.querySelectorAll('table'));
  let tablesAnnotated = 0;
  let leadingCellsAnnotated = 0;
  let detailCellsAnnotated = 0;
  let legacyClassesRemoved = 0;
  const allowFallback = options.allowFallback !== false;

  tables.forEach(table => {
    const classification = classifyTable(table);
    if (!classification) return;
    if (!allowFallback && !classification.hasDetectedHeaders) return;

    // Keep table semantics generic and avoid legacy profile classes.
    setDataAttr(table, 'data-onc-table-layout', 'two-column');
    legacyClassesRemoved += removeClassNames(table, ['cornell-table']);
    tablesAnnotated += 1;

    classification.rows.forEach(row => {
      const cells = getRowCells(row);
      const cueCell = cells[classification.cueIndex];
      const notesCell = cells[classification.notesIndex];
      if (cueCell) {
        setDataAttr(cueCell, 'data-onc-col-role', 'leading');
        legacyClassesRemoved += removeClassNames(cueCell, ['cues']);
        leadingCellsAnnotated += 1;
      }
      if (notesCell) {
        setDataAttr(notesCell, 'data-onc-col-role', 'detail');
        legacyClassesRemoved += removeClassNames(notesCell, ['notes']);
        detailCellsAnnotated += 1;
      }
    });

    // Defensive cleanup for legacy classes outside the inferred column indexes.
    const legacyCells = Array.from(table.querySelectorAll('.cues, .notes'));
    legacyCells.forEach(cell => {
      if (cell.classList && cell.classList.contains('cues')) {
        setDataAttr(cell, 'data-onc-col-role', 'leading');
      }
      if (cell.classList && cell.classList.contains('notes')) {
        setDataAttr(cell, 'data-onc-col-role', 'detail');
      }
      legacyClassesRemoved += removeClassNames(cell, ['cues', 'notes']);
    });
  });

  if (tablesAnnotated) {
    logs.push({
      step: 'annotateTableSemantics',
      tablesAnnotated,
      leadingCellsAnnotated,
      detailCellsAnnotated,
      legacyClassesRemoved,
      allowFallback
    });
  }

  return logs;
}

