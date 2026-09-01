// @ts-check
// src/ui-downloads.js
import { baseNameFromFile, toFolderSafeName } from './importers/sourceKind.js';
import { normalizeExportStem, buildUniqueFilename } from './export-filenames.js';
import { buildUiConversionConfig } from './ui-options.js';
import { createLogger } from './logging.js';
const logger = createLogger('ui');

/**
 * @typedef {import('./contracts.js').NativeImportResult} NativeImportResult
 * @typedef {import('./contracts.js').OutputAsset} OutputAsset
 * @typedef {import('./contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {import('./ui-options.js').AdvancedOptionsControls} AdvancedOptionsControls
 * @typedef {'html' | 'markdown'} DownloadOutputFormat
 * @typedef {{ prop: string, val: string }} CssDeclarationEntry
 * @typedef {{ content: string, format: DownloadOutputFormat, assets: OutputAsset[], config: PipelineConfigInput | null }} SuccessfulOutputRecord
 * @typedef {string | { content?: string, html?: string, format?: string, assets?: OutputAsset[], config?: PipelineConfigInput | null }} SuccessfulOutputValue
 * @typedef {{ hrefs: string[], stylesByHref: Record<string, string> }} StylesheetDependencyResult
 * @typedef {{ binary?: boolean }} JSZipFileOptions
 * @typedef {{ file: (name: string, data: string | Uint8Array, options?: JSZipFileOptions) => void, generateAsync: (options: { type: 'blob', compression?: string, mimeType?: string }) => Promise<Blob> }} JSZipLike
 * @typedef {new () => JSZipLike} JSZipConstructor
 * @typedef {{ disabled: boolean, textContent: string | null }} DownloadZipButton
 * @typedef {AdvancedOptionsControls & { downloadZipButton?: DownloadZipButton | null, successfulOutputs: Map<string, SuccessfulOutputValue>, [key: string]: unknown }} DownloadContext
 * @typedef {{ downloadBlob: (filename: string, text: string, mime?: string) => Promise<void>, downloadDebug: (name: string, text: string) => void, downloadBinary: (filename: string, blob: Blob) => void, downloadZip: () => Promise<void>, downloadNativeZip: (file: File, nativeResult: NativeImportResult) => Promise<void>, getConversionConfig: () => PipelineConfigInput }} DownloadHelpers
 */

/**
 * @param {unknown} value
 * @returns {string}
 */

function normalizeCssToken(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {CssDeclarationEntry | null} entry
 * @returns {entry is CssDeclarationEntry}
 */
function isCssDeclarationEntry(entry) {
  return entry !== null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function canonicalizeCssDeclaration(value) {
  const entries = String(value || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(':');
      if (idx === -1) return null;
      const prop = part.slice(0, idx).trim().toLowerCase();
      const val = normalizeCssToken(part.slice(idx + 1));
      if (!prop) return null;
      return { prop, val };
    })
    .filter(isCssDeclarationEntry)
    .sort((a, b) => a.prop.localeCompare(b.prop));

  return entries.map(({ prop, val }) => `${prop}:${val}`).join(';');
}

/** @type {Set<string>} */
const BUNDLED_STYLESHEET_HREFS = new Set([
  'assets/tailwind-output.css'
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {unknown} tagText
 * @param {unknown} attributeName
 * @returns {string}
 */
function getTagAttributeValue(tagText, attributeName) {
  const normalizedName = String(attributeName || '').trim();
  if (!normalizedName) return '';
  const quoted = new RegExp(`${normalizedName}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(String(tagText || ''));
  if (quoted) return String(quoted[2] || '').trim();
  const bare = new RegExp(`${normalizedName}\\s*=\\s*([^\\s>]+)`, 'i').exec(String(tagText || ''));
  return bare ? String(bare[1] || '').trim() : '';
}

/**
 * @param {unknown} tagText
 * @returns {boolean}
 */
function isStylesheetLinkTag(tagText) {
  const rel = getTagAttributeValue(tagText, 'rel');
  return /(^|\s)stylesheet(\s|$)/i.test(rel);
}

/**
 * @param {unknown} href
 * @returns {boolean}
 */
function isBundledStylesheetHref(href) {
  return BUNDLED_STYLESHEET_HREFS.has(String(href || '').trim());
}

/**
 * @param {unknown} html
 * @returns {string[]}
 */
export function collectStylesheetHrefs(html) {
  const hrefs = /** @type {string[]} */ ([]);
  const seen = /** @type {Set<string>} */ (new Set());
  const tagMatches = String(html || '').match(/<link\b[^>]*>/ig) || [];

  tagMatches.forEach((tagText) => {
    if (!isStylesheetLinkTag(tagText)) return;
    const href = getTagAttributeValue(tagText, 'href');
    if (!href || seen.has(href)) return;
    seen.add(href);
    hrefs.push(href);
  });

  return hrefs;
}

/**
 * @param {unknown} html
 * @param {Record<string, string>} [stylesByHref]
 * @returns {string}
 */
export function inlineStylesheetLinks(html, stylesByHref = {}) {
  let output = String(html || '');

  Object.entries(stylesByHref || {}).forEach(([href, cssText]) => {
    const normalizedHref = String(href || '').trim();
    const normalizedCss = String(cssText || '');
    if (!normalizedHref || !normalizedCss.trim()) return;
    if (output.indexOf(normalizedHref) === -1) return;

    const marker = `data-onc-inline-stylesheet="${escapeHtmlAttribute(normalizedHref)}"`;
    const styleTag = `<style ${marker}>\n${normalizedCss}\n</style>`;
    let injected = false;

    output = output.replace(/<link\b[^>]*>/ig, (tagText) => {
      if (!isStylesheetLinkTag(tagText)) return tagText;
      const tagHref = getTagAttributeValue(tagText, 'href');
      if (tagHref !== normalizedHref) return tagText;
      if (injected) return '';
      injected = true;
      return styleTag;
    });
  });

  return output;
}

/**
 * @param {unknown} html
 * @param {string[]} [hrefs]
 * @returns {string}
 */
export function removeStylesheetLinks(html, hrefs = []) {
  const hrefSet = new Set((hrefs || []).map((href) => String(href || '').trim()).filter(Boolean));
  if (!hrefSet.size) return String(html || '');

  return String(html || '').replace(/<link\b[^>]*>/ig, (tagText) => {
    if (!isStylesheetLinkTag(tagText)) return tagText;
    const tagHref = getTagAttributeValue(tagText, 'href');
    return hrefSet.has(tagHref) ? '' : tagText;
  });
}

// Consolidates duplicated selector+declaration rule blocks while preserving first-seen order.
/**
 * @param {unknown} cssText
 * @returns {string}
 */
export function consolidateCssRules(cssText) {
  const css = String(cssText || '');
  if (!css.trim()) return '';

  const rules = /** @type {string[]} */ ([]);
  const seen = /** @type {Set<string>} */ (new Set());
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;

  while ((match = re.exec(css)) !== null) {
    const selector = normalizeCssToken(match[1]);
    const declaration = canonicalizeCssDeclaration(match[2]);
    if (!selector || !declaration) continue;

    const key = `${selector}\u0000${declaration}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push(`${selector} { ${declaration} }`);
  }

  // Fallback to original text when no parseable rule blocks are found.
  if (!rules.length) return css.trim();
  return rules.join('\n\n');
}

/**
 * @param {DownloadContext} ctx
 * @param {() => void} updateZipButton
 * @returns {DownloadHelpers}
 */
export function createDownloadHelpers(ctx, updateZipButton) {
  /** @type {Map<string, Promise<string>>} */
  const bundledStylesheetCache = new Map();

  /**
   * @param {SuccessfulOutputValue} value
   * @returns {SuccessfulOutputRecord}
   */
  function getSuccessfulOutputRecord(value) {
    if (value && typeof value === 'object' && typeof value.content === 'string') {
      return {
        content: value.content,
        format: value.format === 'markdown' ? 'markdown' : 'html',
        assets: Array.isArray(value.assets) ? value.assets : [],
        config: value.config || null
      };
    }

    if (value && typeof value === 'object' && typeof value.html === 'string') {
      return {
        content: value.html,
        format: 'html',
        assets: Array.isArray(value.assets) ? value.assets : [],
        config: value.config || null
      };
    }

    return {
      content: typeof value === 'string' ? value : '',
      format: 'html',
      assets: [],
      config: null
    };
  }

  /**
   * @param {string} html
   * @param {string} href
   * @returns {string}
   */
  function ensureStylesheetLink(html, href) {
    const linkTag = `<link rel="stylesheet" href="${href}">`;
    if (new RegExp(`<link\\s+[^>]*href=["']${escapeRegExp(href)}["'][^>]*>`, 'i').test(html)) {
      return html;
    }
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, `${linkTag}</head>`);
    }
    if (/<html[^>]*>/i.test(html)) {
      return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${linkTag}</head>`);
    }
    return `${linkTag}${html}`;
  }

  /**
   * @param {SuccessfulOutputRecord} record
   * @returns {string}
   */
  function getCssAssetContent(record) {
    const cssAsset = (record.assets || []).find(asset => asset && asset.type === 'text/css' && typeof asset.content === 'string');
    return cssAsset && typeof cssAsset.content === 'string' ? cssAsset.content : '';
  }

  /**
   * @param {string} href
   * @returns {Promise<string>}
   */
  async function fetchBundledStylesheetText(href) {
    const normalizedHref = String(href || '').trim();
    if (!isBundledStylesheetHref(normalizedHref)) return '';
    if (bundledStylesheetCache.has(normalizedHref)) {
      return bundledStylesheetCache.get(normalizedHref) || '';
    }

    const pending = (async () => {
      try {
        const resolvedHref = new URL(normalizedHref, document.baseURI).href;
        const response = await fetch(resolvedHref, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.text();
      } catch (error) {
        logger.warn({
          msg: 'Failed to load bundled stylesheet asset for standalone export fallback',
          meta: { href: normalizedHref, error: String(error) }
        });
        return '';
      }
    })();

    bundledStylesheetCache.set(normalizedHref, pending);
    return pending;
  }

  /**
   * @param {unknown} html
   * @returns {Promise<string>}
   */
  async function inlineBundledStylesheetDependencies(html) {
    const hrefs = collectStylesheetHrefs(html).filter(isBundledStylesheetHref);
    if (!hrefs.length) return String(html || '');

    const stylesByHref = /** @type {Record<string, string>} */ ({});
    for (const href of hrefs) {
      const cssText = await fetchBundledStylesheetText(href);
      if (!cssText.trim()) continue;
      stylesByHref[href] = cssText;
    }

    if (!Object.keys(stylesByHref).length) {
      return String(html || '');
    }

    return inlineStylesheetLinks(html, stylesByHref);
  }

  /**
   * @param {unknown} html
   * @returns {Promise<StylesheetDependencyResult>}
   */
  async function collectBundledStylesheetDependencies(html) {
    const hrefs = collectStylesheetHrefs(html).filter(isBundledStylesheetHref);
    if (!hrefs.length) {
      return { hrefs: [], stylesByHref: {} };
    }

  const stylesByHref = /** @type {Record<string, string>} */ ({});
    for (const href of hrefs) {
      const cssText = await fetchBundledStylesheetText(href);
      if (!cssText.trim()) continue;
      stylesByHref[href] = cssText;
    }

    return { hrefs, stylesByHref };
  }

  /**
   * @param {string} filename
   * @param {string} text
   * @param {string} [mime]
   * @returns {Promise<void>}
   */
  async function downloadBlob(filename, text, mime = 'text/html') {
    const bom = '\uFEFF';
    const isHtml = /^text\/html(?:;|$)/i.test(String(mime || ''));
    const preparedText = isHtml
      ? await inlineBundledStylesheetDependencies(text || '')
      : (text || '');
    const content = bom + preparedText;

    const hasCharset = /<meta\s+charset=["']?utf-8["']?/i.test(content)
      || /<meta\s+http-equiv=["']content-type["']\s+content=["'][^"']*charset=utf-8/i.test(content);
    const hasDataImages = /data:image\//i.test(content);
    logger.info({ msg: `downloadBlob: filename=${filename}`, meta: { hasCharset, hasDataImages, length: content.length } });

    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  /**
   * @param {string} name
   * @param {string} text
   * @returns {void}
   */
  function downloadDebug(name, text) {
    downloadBlob(name, text, 'text/plain');
  }

  /**
   * @param {string} filename
   * @param {Blob} blob
   * @returns {void}
   */
  function downloadBinary(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  /**
   * @returns {string}
   */
  function getZipFilename() {
    const now = new Date();
    /**
     * @param {number} n
     * @returns {string}
     */
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `cleaned_${stamp}.zip`;
  }

  /**
   * @returns {PipelineConfigInput}
   */
  function getConversionConfig() {
    return buildUiConversionConfig(ctx);
  }

  /**
   * @returns {Promise<void>}
   */
  async function downloadZip() {
    if (!ctx.downloadZipButton || ctx.downloadZipButton.disabled) return;
    const appWindow = /** @type {Window & typeof globalThis & { JSZip?: JSZipConstructor }} */ (window);
    const JSZip = appWindow.JSZip;
    if (!JSZip) {
      logger.error({ msg: 'JSZip not available; ensure dependency is installed and loaded' });
      return;
    }

    const zip = new JSZip();
    const sharedCssParts = [];
    const sharedCssFilename = 'converted-shared.css';
    const perPageCssTaken = new Set();
    const packagedBundledStylesheets = new Set();
    const warnings = [];

    for (const [name, value] of ctx.successfulOutputs.entries()) {
      const record = getSuccessfulOutputRecord(value);
      const isMarkdown = record.format === 'markdown' || String(name || '').toLowerCase().endsWith('.md');
      let content = record.content || '';
      const config = record.config || {};

      if (isMarkdown) {
        zip.file(name, `\uFEFF${content}`);
        continue;
      }

      const externalizeEnabled = config.ExternalizeCssEnabled === true;
      const cssMode = String(config.ExternalizeCssMode || 'shared').toLowerCase() === 'per-page' ? 'per-page' : 'shared';
      const cssContent = getCssAssetContent(record).trim();

      if (externalizeEnabled && cssContent) {
        if (cssMode === 'per-page') {
          const rawStem = String(name || 'output.html').replace(/\.[^./\\]+$/i, '') || 'output';
          const stem = normalizeExportStem(rawStem, { fallback: 'converted-page' });
          const cssName = buildUniqueFilename(stem, 'css', perPageCssTaken);
          content = ensureStylesheetLink(content, cssName);
          zip.file(cssName, `${cssContent}\n`);
        } else {
          content = ensureStylesheetLink(content, sharedCssFilename);
          sharedCssParts.push(cssContent);
        }
      } else if (externalizeEnabled && !cssContent) {
        warnings.push(`${name}: Externalize CSS is enabled, but no CSS sidecar was produced. Falling back to HTML output as-is.`);
      }

      if (externalizeEnabled) {
        const { hrefs, stylesByHref } = await collectBundledStylesheetDependencies(content);
        const missingHrefs = hrefs.filter((href) => !stylesByHref[href]);

        if (missingHrefs.length) {
          warnings.push(`${name}: Failed to package bundled stylesheet dependency (${missingHrefs.join(', ')}). Falling back to inline bundled stylesheet.`);
          content = await inlineBundledStylesheetDependencies(content);
        } else {
          Object.entries(stylesByHref).forEach(([href, cssText]) => {
            if (cssMode === 'shared') {
              sharedCssParts.push(cssText);
              return;
            }
            if (packagedBundledStylesheets.has(href)) return;
            zip.file(href, `${cssText}\n`);
            packagedBundledStylesheets.add(href);
          });

          if (cssMode === 'shared' && Object.keys(stylesByHref).length) {
            content = removeStylesheetLinks(content, Object.keys(stylesByHref));
          }
        }
      } else {
        content = await inlineBundledStylesheetDependencies(content);
      }

      zip.file(name, `\uFEFF${content}`);
    }

    if (sharedCssParts.length) {
      const consolidated = consolidateCssRules(sharedCssParts.filter(Boolean).join('\n\n'));
      zip.file(sharedCssFilename, `${consolidated}\n`);
    }

    if (warnings.length) {
      zip.file('README.txt', [
        'Some optional export features required fallback behavior during ZIP build.',
        '',
        ...warnings
      ].join('\n'));
    }

    ctx.downloadZipButton.disabled = true;
    ctx.downloadZipButton.textContent = 'Building ZIP...';

    try {
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/zip' });
      downloadBinary(getZipFilename(), blob);
    } finally {
      ctx.downloadZipButton.textContent = 'Download ZIP';
      updateZipButton();
    }
  }

  /**
   * @param {File} file
   * @param {NativeImportResult} nativeResult
   * @returns {Promise<void>}
   */
  async function downloadNativeZip(file, nativeResult) {
    const appWindow = /** @type {Window & typeof globalThis & { JSZip?: JSZipConstructor }} */ (window);
    const JSZip = appWindow.JSZip;
    if (!JSZip) {
      logger.error({ msg: 'JSZip not available; ensure dependency is installed and loaded' });
      return;
    }

    const zip = new JSZip();
    const pages = Array.isArray(nativeResult && nativeResult.pages) ? nativeResult.pages : [];
    const writtenResources = new Set();

    for (const page of pages) {
      if (!page || !page.path) continue;
      zip.file(page.path, `\uFEFF${page.html || ''}`);

      const metadata = page && typeof page.metadata === 'object' ? page.metadata : null;
      if (metadata) {
        const metadataPath = page.path.endsWith('.html')
          ? page.path.replace(/\.html$/i, '.metadata.json')
          : `${page.path}.metadata.json`;

        zip.file(metadataPath, `${JSON.stringify({ name: page.name || null, path: page.path, metadata }, null, 2)}\n`);
      }

      const resources = Array.isArray(page.resources) ? page.resources : [];
      for (const resource of resources) {
        if (!resource || !resource.path || writtenResources.has(resource.path)) continue;

        const rawBytes = resource.bytes;
        const payload = rawBytes instanceof Uint8Array
          ? rawBytes
          : rawBytes instanceof ArrayBuffer
            ? new Uint8Array(rawBytes)
            : null;

        if (!payload || payload.length === 0) continue;
        zip.file(resource.path, payload, { binary: true });
        writtenResources.add(resource.path);
      }
    }

    if (pages.length === 0) {
      const baseName = toFolderSafeName(baseNameFromFile(file.name));
      const warnings = Array.isArray(nativeResult && nativeResult.warnings) ? nativeResult.warnings : [];
      zip.file(`${baseName}/README.txt`, ['No converted pages were available for export in this build.', '', ...warnings].join('\n'));
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/zip' });
    downloadBinary(`${baseNameFromFile(file.name)}_converted.zip`, blob);
  }

  return {
    downloadBlob,
    downloadDebug,
    downloadBinary,
    downloadZip,
    downloadNativeZip,
    getConversionConfig
  };
}
