// @ts-check

// src/pipeline/parser.js

/**
 * @typedef {{ outerHTML: string }} DocumentElementLike
 * @typedef {{ name: string, publicId?: string | null, systemId?: string | null }} DoctypeLike
 * @typedef {{ documentElement?: DocumentElementLike | null, doctype?: DoctypeLike | null }} HtmlDocumentLike
 * @typedef {{ parseFromString: (input: string, mimeType: string) => HtmlDocumentLike }} DomParserLike
 */

/**
 * @param {unknown} htmlString
 * @returns {HtmlDocumentLike}
 */
export function parseHtmlToDocument(htmlString) {
  const ParserCtor = /** @type {new () => DomParserLike} */ ((/** @type {{ DOMParser?: unknown }} */ (globalThis)).DOMParser);
  const parser = new ParserCtor();
  const doc = parser.parseFromString(String(htmlString), 'text/html');
  return doc;
}

/**
 * @param {HtmlDocumentLike | null | undefined} doc
 * @returns {string}
 */
export function documentToHtml(doc) {
  const doctype = buildDoctype(doc);
  const html = doc && doc.documentElement ? doc.documentElement.outerHTML : '';
  return doctype + '\n' + html;
}

/**
 * @param {HtmlDocumentLike | null | undefined} doc
 * @returns {string}
 */
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
