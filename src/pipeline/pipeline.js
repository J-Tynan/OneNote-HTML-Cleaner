// src/pipeline/pipeline.js
import { parseHtmlToDocument, documentToHtml } from './parser.js';
import * as sanitize from './sanitize.js';
import { fixLists } from './listRepair.js';
import { annotateCornellSemantics } from './cornellSemantics.js';
import { mergeCreatedDateTimeRow } from './dateTimeLayout.js';
import { migrateInlineStylesToUtilities } from './inlineStyleMigration.js';
import * as images from './images.js';
import * as format from './format.js';

/**
 * runPipeline(htmlString, config)
 * - returns { output: string, logs: Array }
 *
 * Adds runtime diagnostics to help trace MHT -> HTML conversion issues.
 */
export async function runPipeline(htmlString, config = {}) {
  const logs = [];

  try {
    // Basic input validation & preview
    if (typeof htmlString !== 'string') {
      console.warn('[pipeline] htmlString is not a string', typeof htmlString);
      logs.push({ step: 'validateInput', level: 'warn', details: 'htmlString not a string' });
    }
    const preview = (htmlString || '').slice(0, 2000);
    console.log('[pipeline] input preview:', preview.replace(/\r?\n/g, '\\n').slice(0, 1000));
    if (!/<!doctype|<html|<body/i.test(preview)) {
      console.warn('[pipeline] input does not look like decoded HTML; may be raw MHT or encoded content');
      logs.push({ step: 'validateInput', level: 'warn', details: 'input does not look like HTML' });
    }

    // If the input contains obvious MHTML markers, log them
    if (/^From:|^Content-Type: multipart\/related|^--|Single File Web Page|Web Archive/i.test(preview)) {
      console.warn('[pipeline] input contains MHTML markers; ensure MHT parsing/decoding ran before pipeline');
      logs.push({ step: 'validateInput', level: 'warn', details: 'MHTML markers detected in input' });
    }

    // Parse into a Document (DOMParser must be available in caller)
    const doc = parseHtmlToDocument(htmlString || '<!doctype html><html><head></head><body></body></html>');
    logs.push(...ensureArray(sanitize.ensureHead(doc, { defaultTitle: config.defaultTitle })));
    logs.push(...ensureArray(sanitize.removeOneNoteMeta(doc)));
    logs.push(...ensureArray(sanitize.sanitizeImageAttributes(doc)));
    logs.push(...ensureArray(sanitize.removeNbsp(doc)));

    const useCornellSemantics = config.UseCornellSemantics !== false;
    if (useCornellSemantics) {
      logs.push(...ensureArray(annotateCornellSemantics(doc, {
        allowFallback: config.CornellHeaderFallback !== false
      })));
    }

    const mergeCreatedDateTime = config.MergeCreatedDateTime !== false;
    if (mergeCreatedDateTime) {
      logs.push(...ensureArray(mergeCreatedDateTimeRow(doc, {
        gap: config.CreatedDateTimeGap || '0.75em'
      })));
    }

    const migrateInlineStyles = config.MigrateInlineStylesToUtilities !== false;
    if (migrateInlineStyles) {
      logs.push(...ensureArray(migrateInlineStylesToUtilities(doc, {
        selector: config.InlineStyleMigrationSelector || '[style]',
        removeMigratedDeclarations: config.RemoveMigratedInlineDeclarations === true
      })));
    }

    // List repair
    const listMode = config.RepairListItemValues || 'smart';
    logs.push(...ensureArray(fixLists(doc, listMode, {
      listPaddingLeft: config.ListPaddingLeft || '1.2em',
      normalizeAllListIndent: config.NormalizeAllListIndent === true
    })));

    const injectTailwindCss = config.InjectTailwindCss !== false;
    if (injectTailwindCss) {
      logs.push(...ensureArray(sanitize.injectCssLink(doc, config.TailwindCssHref || 'assets/tailwind-output.css')));
    }

    // Image embedding (map may be provided in config.imageMap)
    const map = config.imageMap || {};
    logs.push(...ensureArray(images.embedImagesInHtml(doc, map)));

    // Formatting
    logs.push(...ensureArray(format.formatDocument(doc)));

    // Serialize and normalize whitespace
    const serialized = documentToHtml(doc);
    const normalized = format.normalizeWhitespace(serialized);

    // Final sanity check: does output look like HTML?
    const outPreview = (normalized || '').slice(0, 1000);
    console.log('[pipeline] output preview:', outPreview.replace(/\r?\n/g, '\\n'));
    if (!/<!doctype|<html|<body/i.test(outPreview)) {
      console.warn('[pipeline] output does not look like HTML; investigate earlier steps');
      logs.push({ step: 'validateOutput', level: 'warn', details: 'output does not look like HTML' });
    }

    return { output: normalized, logs };
  } catch (err) {
    console.error('[pipeline] unexpected error:', err);
    logs.push({ step: 'pipelineError', level: 'error', details: String(err) });
    throw err;
  }
}

function ensureArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
