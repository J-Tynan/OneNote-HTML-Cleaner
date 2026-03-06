function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function setDataAttr(el, name, value) {
  if (!el || !name) return;
  if (value === null || value === undefined || value === '') return;
  el.setAttribute(name, String(value));
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

function classifyTable(table) {
  const rows = getTableRows(table);
  if (!rows.length) return null;

  const firstCells = getRowCells(rows[0]);
  if (firstCells.length < 2) return null;

  const detected = detectHeaderIndexes(firstCells);
  const hasDetectedHeaders = detected.cueIndex !== -1 || detected.notesIndex !== -1;

  const cueIndex = detected.cueIndex !== -1 ? detected.cueIndex : 0;
  const notesIndex = detected.notesIndex !== -1 ? detected.notesIndex : 1;

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
  const allowFallback = options.allowFallback !== false;

  tables.forEach(table => {
    const classification = classifyTable(table);
    if (!classification) return;
    if (!allowFallback && !classification.hasDetectedHeaders) return;

    // Keep table semantics generic and avoid legacy profile classes.
    setDataAttr(table, 'data-onc-table-layout', 'two-column');
    tablesAnnotated += 1;

    classification.rows.forEach(row => {
      const cells = getRowCells(row);
      const cueCell = cells[classification.cueIndex];
      const notesCell = cells[classification.notesIndex];
      if (cueCell) {
        setDataAttr(cueCell, 'data-onc-col-role', 'leading');
        leadingCellsAnnotated += 1;
      }
      if (notesCell) {
        setDataAttr(notesCell, 'data-onc-col-role', 'detail');
        detailCellsAnnotated += 1;
      }
    });
  });

  if (tablesAnnotated) {
    logs.push({
      step: 'annotateTableSemantics',
      tablesAnnotated,
      leadingCellsAnnotated,
      detailCellsAnnotated,
      allowFallback
    });
  }

  return logs;
}

