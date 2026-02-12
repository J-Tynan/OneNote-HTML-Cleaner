function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function addClass(el, className) {
  if (!el || !className) return;
  if (typeof el.classList !== 'undefined') {
    el.classList.add(className);
    return;
  }

  const classes = new Set(String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean));
  classes.add(className);
  el.setAttribute('class', Array.from(classes).join(' '));
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

export function annotateCornellSemantics(doc, options = {}) {
  const logs = [];
  const tables = Array.from(doc.querySelectorAll('table'));
  let tablesTagged = 0;
  let cueCellsTagged = 0;
  let notesCellsTagged = 0;
  const allowFallback = options.allowFallback !== false;

  tables.forEach(table => {
    const classification = classifyTable(table);
    if (!classification) return;
    if (!allowFallback && !classification.hasDetectedHeaders) return;

    addClass(table, 'cornell-table');
    tablesTagged += 1;

    classification.rows.forEach(row => {
      const cells = getRowCells(row);
      const cueCell = cells[classification.cueIndex];
      const notesCell = cells[classification.notesIndex];
      if (cueCell) {
        addClass(cueCell, 'cues');
        cueCellsTagged += 1;
      }
      if (notesCell) {
        addClass(notesCell, 'notes');
        notesCellsTagged += 1;
      }
    });
  });

  if (tablesTagged) {
    logs.push({
      step: 'annotateCornellSemantics',
      tablesTagged,
      cueCellsTagged,
      notesCellsTagged,
      allowFallback
    });
  }

  return logs;
}
