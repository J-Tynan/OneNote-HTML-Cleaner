// src/pipeline/format.js
export function normalizeWhitespace(html) {
  // Only normalize non-breaking spaces; preserve all other spacing and line breaks.
  let out = String(html || '');
  out = out.replace(/\u00a0/g, ' ');
  out = out.replace(/&nbsp;/gi, ' ');
  return out;
}

export function formatDocument(doc, options = {}) {
  // Optionally pretty-print; for now return doc unchanged and a log
  return [{ step: 'format', details: 'normalized nbsp only' }];
}
