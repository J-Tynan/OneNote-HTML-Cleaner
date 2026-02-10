// src/pipeline/parser.js
export function parseHtmlToDocument(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  return doc;
}

export function documentToHtml(doc) {
  const doctype = buildDoctype(doc);
  const html = doc && doc.documentElement ? doc.documentElement.outerHTML : '';
  return doctype + '\n' + html;
}

function buildDoctype(doc) {
  if (!doc || !doc.doctype) return '<!DOCTYPE html>';
  const dt = doc.doctype;
  let id = '';
  if (dt.publicId) {
    id += ' PUBLIC "' + dt.publicId + '"';
  } else if (dt.systemId) {
    id += ' SYSTEM';
  }
  if (dt.systemId) {
    id += ' "' + dt.systemId + '"';
  }
  return '<!DOCTYPE ' + dt.name + id + '>';
}
