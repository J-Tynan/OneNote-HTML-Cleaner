// src/pipeline/parser.js
export function parseHtmlToDocument(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  return doc;
}

export function documentToHtml(doc) {
  // Return serialized HTML with doctype if present
  const serializer = new XMLSerializer();
  return '<!DOCTYPE html>\n' + serializer.serializeToString(doc);
}
