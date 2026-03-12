// src/pipeline/pipeline.js
import { parseHtmlToDocument, documentToHtml } from './parser.js';
import { buildOutputDecorationConfig, normalizePipelineConfig } from './config.js';
import * as sanitize from './sanitize.js';
import { fixLists } from './listRepair.js';
import { annotateTableSemantics } from './Semantics.js';
import { mergeCreatedDateTimeRow } from './dateTimeLayout.js';
import {
  enforceHeaderDateTimeStyles,
  normalizeDirectionLayoutContainers
} from './layoutNormalization.js';
import { migrateInlineStylesToUtilities } from './inlineStyleMigration.js';
import * as images from './images.js';
import * as format from './format.js';
import { injectConvertedPageThemeToggle, injectOutputToolbar, summarizeWarningsBySeverity } from './toolbarInjector.js';
import { createLogger } from '../logging.js';
const logger = createLogger('pipeline');

/**
 * runPipeline(htmlString, config)
 * - returns { output: string, logs: Array }
 *
 * Adds runtime diagnostics to help trace MHT -> HTML conversion issues.
 */
export async function runPipeline(htmlString, config = {}) {
  const logs = [];
  const outputAssets = [];
  const resolvedConfig = normalizePipelineConfig(config);
  const parseWarnings = ensureArray(resolvedConfig.ParseWarnings || resolvedConfig.parseWarnings);
  if (parseWarnings.length) {
    logs.push(...parseWarnings.map((entry) => ({
      step: entry && entry.step ? entry.step : 'parseMht',
      level: entry && entry.level ? entry.level : 'warn',
      details: entry && entry.details ? entry.details : 'MHT parse warning',
      ...(entry && entry.meta ? { meta: entry.meta } : {})
    })));
  }

  try {
    // Basic input validation & preview
    if (typeof htmlString !== 'string') {
      logger.warn({ msg: 'htmlString is not a string', meta: { type: typeof htmlString } });
      logs.push({ step: 'validateInput', level: 'warn', details: 'htmlString not a string' });
    }
    const preview = (htmlString || '').slice(0, 2000);
    logger.info({ msg: 'input preview', meta: { preview: preview.replace(/\r?\n/g, '\\n').slice(0, 1000) } });
    if (!/<!doctype|<html|<body/i.test(preview)) {
      logger.warn({ msg: 'input does not look like decoded HTML; may be raw MHT or encoded content' });
      logs.push({ step: 'validateInput', level: 'warn', details: 'input does not look like HTML' });
    }

    // If the input contains obvious MHTML markers, log them
    if (/^From:|^Content-Type: multipart\/related|^--|Single File Web Page|Web Archive/i.test(preview)) {
      logger.warn({ msg: 'input contains MHTML markers; ensure MHT parsing/decoding ran before pipeline' });
      logs.push({ step: 'validateInput', level: 'warn', details: 'MHTML markers detected in input' });
    }

    // Parse into a Document (DOMParser must be available in caller)
    const doc = parseHtmlToDocument(htmlString || '<!doctype html><html><head></head><body></body></html>');
    // core sanitization/structure helpers
    logs.push(...ensureArray(sanitize.ensureHead(doc, {
      defaultTitle: resolvedConfig.defaultTitle,
      defaultLang: resolvedConfig.defaultLang || 'en'
    })));
    logs.push(...ensureArray(sanitize.removeOneNoteMeta(doc)));
    // newly added: strip Office/OneNote cruft (xmlns, mso- attributes, spacerun)
    logs.push(...ensureArray(sanitize.removeOfficeArtifacts(doc)));
    // clean up tables: obsolete attrs, legacy xmlns, summary
    if (resolvedConfig.NormalizeTables !== false) {
      logs.push(...ensureArray(sanitize.normalizeTableAttributes(doc)));
      logs.push(...ensureArray(sanitize.normalizeTableCellParagraphMargins(doc)));
    }
    if (resolvedConfig.OutputCleanupMode === 'safe') {
      logs.push(...ensureArray(sanitize.stripObsoleteHeadArtifacts(doc)));
      logs.push(...ensureArray(sanitize.normalizeLegacyAttributes(doc, {
        removeLegacyDataAttrs: true
      })));
    }
    logs.push(...ensureArray(sanitize.normalizeUnits(doc, {
      unitStrategy: resolvedConfig.UnitStrategy
    })));
    logs.push(...ensureArray(sanitize.normalizeAccessibleTextContrast(doc)));
    logs.push(...ensureArray(sanitize.sanitizeImageAttributes(doc)));
    logs.push(...ensureArray(sanitize.annotateHandwritingAssets(doc, {
      enabled: resolvedConfig.HandwritingDetectionEnabled !== false,
      rasterAltText: resolvedConfig.HandwritingRasterAltText || 'Handwritten notes (raster image)'
    })));
    logs.push(...ensureArray(sanitize.ensureImageAlt(doc, {
      fallbackAlt: resolvedConfig.ImageAltFallback || 'Image'
    })));
    logs.push(...ensureArray(sanitize.removeNbsp(doc)));
    // ensure main and heading after basic sanitization
    logs.push(...ensureArray(sanitize.ensureMainHeading(doc, {
      defaultTitle: resolvedConfig.defaultTitle || resolvedConfig.fileName || 'Document'
    })));
    logs.push(...ensureArray(sanitize.normalizeContentBlankLineSpacers(doc)));
    if (resolvedConfig.NormalizeDirectionLayout !== false) {
      logs.push(...ensureArray(normalizeDirectionLayoutContainers(doc, {
        unwrapRedundantWrappers: true,
        normalizeTopLevelPageWidths: resolvedConfig.NormalizeTopLevelPageWidths !== false,
        standardizeHeaderDatePositions: true
      })));
    }

    const useTableSemantics = resolvedConfig.UseTableSemantics !== false;
    if (useTableSemantics) {
      logs.push(...ensureArray(annotateTableSemantics(doc, {
        allowFallback: resolvedConfig.TableHeaderFallback !== false
      })));
    }

    const mergeCreatedDateTime = resolvedConfig.MergeCreatedDateTime !== false;
    if (mergeCreatedDateTime) {
      logs.push(...ensureArray(mergeCreatedDateTimeRow(doc, {
        gap: resolvedConfig.CreatedDateTimeGap || '0.75em'
      })));
    }
    logs.push(...ensureArray(enforceHeaderDateTimeStyles(doc)));

    const collapseInlineStyles = resolvedConfig.CollapseInlineStyles !== false;
    if (collapseInlineStyles) {
      logs.push(...ensureArray(sanitize.collapseInlineStyleDuplicates(doc, {
        minCount: resolvedConfig.CollapseInlineStylesMinCount || 3,
        removeMigratedDeclarations: resolvedConfig.RemoveMigratedInlineDeclarations === true
      })));
    }

    const migrateInlineStyles = resolvedConfig.MigrateInlineStylesToUtilities !== false;
    if (migrateInlineStyles) {
      logs.push(...ensureArray(migrateInlineStylesToUtilities(doc, {
        selector: resolvedConfig.InlineStyleMigrationSelector || '[style]',
        removeMigratedDeclarations: resolvedConfig.RemoveMigratedInlineDeclarations === true
      })));
    }

    logs.push(...ensureArray(sanitize.warnExcessiveInlineStyles(doc, {
      enabled: resolvedConfig.InlineStyleWarningEnabled !== false,
      maxNodes: resolvedConfig.InlineStyleWarningMaxNodes,
      maxChars: resolvedConfig.InlineStyleWarningMaxChars
    })));

    // List repair
    const listMode = resolvedConfig.RepairListItemValues || 'smart';
    logs.push(...ensureArray(fixLists(doc, listMode, {
      listMarginLeft: resolvedConfig.ListMarginLeft || '0.35em',
      listPaddingLeft: resolvedConfig.ListPaddingLeft || '1.2em',
      normalizeAllListIndent: resolvedConfig.NormalizeAllListIndent === true
    })));
    // repair any malformed list structure left over
    logs.push(...ensureArray(sanitize.ensureListStructure(doc)));
    // defensive deduplication pass to remove any accidental clone/duplicate
    logs.push(...ensureArray(sanitize.dedupeLists(doc)));
    logs.push(...ensureArray(sanitize.ensureCreatedWithOneNoteFooterGap(doc)));
    logs.push(...ensureArray(sanitize.injectFooterSpacerCss(doc)));

    const injectTailwindCss = resolvedConfig.InjectTailwindCss !== false;
    if (injectTailwindCss) {
      logs.push(...ensureArray(sanitize.injectCssLink(doc, resolvedConfig.TailwindCssHref || 'assets/tailwind-output.css')));
    }

    // Image embedding (map may be provided in config.imageMap)
    const map = resolvedConfig.imageMap || {};
    logs.push(...ensureArray(images.embedImagesInHtml(doc, map)));

    // Formatting
    logs.push(...ensureArray(format.formatDocument(doc)));

    if (resolvedConfig.ExternalizeCssEnabled === true) {
      const cssExtraction = sanitize.externalizeCss(doc, {
        externalizeCssEnabled: true,
        externalizeCssMode: resolvedConfig.ExternalizeCssMode || 'shared'
      });
      logs.push(...ensureArray(cssExtraction && cssExtraction.logs));
      if (cssExtraction && typeof cssExtraction.cssText === 'string' && cssExtraction.cssText.trim()) {
        outputAssets.push({
          type: 'text/css',
          role: 'converted-styles',
          mode: resolvedConfig.ExternalizeCssMode || 'shared',
          filename: resolvedConfig.ExternalizeCssMode === 'per-page'
            ? 'converted-page.css'
            : 'converted-shared.css',
          content: cssExtraction.cssText
        });
      }
    }

    // Serialize and normalize whitespace
    const serialized = documentToHtml(doc);
    const normalized = format.normalizeWhitespace(serialized);

    const warningSummary = summarizeWarningsBySeverity(
      logs.filter((item) => item && (item.level === 'warn' || item.level === 'warning' || item.level === 'error'))
        .map((item) => ({ severity: item.level === 'warn' ? 'warning' : item.level }))
    );

    const outputDecorationConfig = buildOutputDecorationConfig(resolvedConfig);
    const exportState = {
      ExperimentalExportEnabled: outputDecorationConfig.ExperimentalExportEnabled,
      ExportFormat: outputDecorationConfig.ExportFormat,
      MarkdownFlavor: outputDecorationConfig.MarkdownFlavor
    };

    const withToolbar = injectOutputToolbar(normalized, {
      ...outputDecorationConfig,
      exportState,
      SourceName: resolvedConfig.SourceName || resolvedConfig.fileName || 'Converted file',
      SourceKind: resolvedConfig.SourceKind || resolvedConfig.sourceKind || 'html',
      WarningSummary: warningSummary
    });

    const withThemeToggle = injectConvertedPageThemeToggle(withToolbar, {
      ...outputDecorationConfig,
      exportState
    });

    if (withToolbar !== normalized) {
      logs.push({ step: 'injectToolbar', level: 'info', details: 'Injected single advanced toolbar (inline bundle).' });
    }
    if (withThemeToggle !== withToolbar) {
      logs.push({ step: 'injectConvertedPageThemeToggle', level: 'info', details: 'Injected converted-page Light/Dark toggle (inline bundle).' });
    }

    // Final sanity check: does output look like HTML?
    const outPreview = (withThemeToggle || '').slice(0, 1000);
    logger.info({ msg: 'output preview', meta: { preview: outPreview.replace(/\r?\n/g, '\\n') } });
    if (!/<!doctype|<html|<body/i.test(outPreview)) {
      logger.warn({ msg: 'output does not look like HTML; investigate earlier steps' });
      logs.push({ step: 'validateOutput', level: 'warn', details: 'output does not look like HTML' });
    }

    return { output: withThemeToggle, logs, assets: outputAssets };
  } catch (err) {
    logger.error({ msg: 'unexpected error', meta: { error: String(err) } });
    logs.push({ step: 'pipelineError', level: 'error', details: String(err) });
    throw err;
  }
}

function ensureArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
