// Markdown architecture guardrail:
// This converter accepts sanitized HTML as canonical input only.
// Raw MHTML must be parsed and sanitized by the HTML pipeline before conversion.

import { createMarkdownIrFromDocument, renderMarkdownFromIr } from './markdownIr.js';
import { applyMarkdownFlavor, normalizeMarkdownFlavor } from './markdownFlavors.js';

function ensureDomParserAvailable() {
  if (typeof DOMParser === 'undefined') {
    throw new Error('DOMParser is not available in this runtime.');
  }
}

function looksLikeRawMhtml(input) {
  const preview = String(input || '').slice(0, 4000);
  return /^From:/im.test(preview)
    || /^Content-Type:\s*multipart\/related/im.test(preview)
    || /MIME-Version:\s*1\.0/im.test(preview)
    || /Single File Web Page/i.test(preview);
}

function normalizeLineBreaks(value) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

function isHtmlLike(input) {
  return /<html|<body|<!doctype/i.test(String(input || ''));
}


export function assertMarkdownSourceIsSanitizedHtml(htmlInput) {
  const input = String(htmlInput || '');
  if (!input.trim()) {
    throw new Error('Markdown conversion requires sanitized HTML input, but received empty input.');
  }
  if (looksLikeRawMhtml(input)) {
    throw new Error('Markdown conversion requires sanitized HTML input, but raw MHTML markers were detected.');
  }
  if (!isHtmlLike(input)) {
    throw new Error('Markdown conversion requires sanitized HTML input with HTML document structure.');
  }
}

export function convertSanitizedHtmlToMarkdown(htmlInput, options = {}) {
  ensureDomParserAvailable();
  assertMarkdownSourceIsSanitizedHtml(htmlInput);

  const allowInlineHtml = options && options.allowInlineHtml === true;
  const flavor = normalizeMarkdownFlavor(options && options.flavor);
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(htmlInput), 'text/html');
  const irDocument = createMarkdownIrFromDocument(doc);
  const baseMarkdown = renderMarkdownFromIr(irDocument);
  const markdown = applyMarkdownFlavor(baseMarkdown, { flavor });

  if (!allowInlineHtml && /<(div|span|table)\b/i.test(markdown)) {
    throw new Error('Markdown output contains prohibited inline HTML tags.');
  }

  return markdown;
}
