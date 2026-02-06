// src/pipeline/format.js
export function normalizeWhitespace(html) {
  // Collapse multiple spaces and blank lines; keep simple and safe
  let out = html.replace(/ {2,}/g, ' ');
  out = out.replace(/(\r?\n){2,}/g, '\r\n');
  // Trim spaces before attribute quotes
  out = out.replace(/\s+"/g, '"').replace(/\s+'/g, "'");
  return out;
}

export function formatDocument(doc, options = {}) {
  // Optionally pretty-print; for now return doc unchanged and a log
  return [{ step: 'format', details: 'normalized whitespace' }];
}
