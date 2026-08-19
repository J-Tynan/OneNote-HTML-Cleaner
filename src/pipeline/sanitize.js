// src/pipeline/sanitize.js
// Lightweight sanitization and head cleanup inspired by the PowerShell script.

import {
  parseStyleDeclarationEntries,
  serializeStyleDeclarationEntries
} from './styleUtils.js';

const OFFICE_NS_RE = /^https?:\/\/schemas\.microsoft\.com\/(office|onenote|word)/i;

// small helper to add a class to an element (works even without classList)
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

function normalizeLangValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  if (trimmed.length > 35) return null;
  if (/[^A-Za-z0-9-]/.test(trimmed)) return null;
  if (/--/.test(trimmed) || trimmed.startsWith('-') || trimmed.endsWith('-')) return null;
  const parts = trimmed.split('-');
  if (!parts.length) return null;
  if (!/^[A-Za-z]{2,3}$/.test(parts[0])) return null;
  for (let i = 1; i < parts.length; i += 1) {
    const token = parts[i];
    if (!/^[A-Za-z0-9]{2,8}$/.test(token)) return null;
  }
  return trimmed;
}

function resolveDocumentLang(html, body, fallback = 'en') {
  const htmlLang = normalizeLangValue(html && html.getAttribute ? html.getAttribute('lang') : null);
  if (htmlLang) return { value: htmlLang, source: 'html' };

  const bodyLang = normalizeLangValue(body && body.getAttribute ? body.getAttribute('lang') : null);
  if (bodyLang) return { value: bodyLang, source: 'body' };

  const fallbackLang = normalizeLangValue(fallback) || 'en';
  return { value: fallbackLang, source: 'fallback' };
}

function normalizeCssToken(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseInlineStyle(styleText) {
  return parseStyleDeclarationEntries(styleText);
}

function serializeInlineStyle(entries) {
  return serializeStyleDeclarationEntries(entries);
}

function dedupeInlineStyle(styleText) {
  const byProp = new Map();
  parseInlineStyle(styleText).forEach(({ prop, value }) => {
    byProp.set(prop, value);
  });
  return serializeInlineStyle(Array.from(byProp.entries()).map(([prop, value]) => ({ prop, value })));
}

function normalizeCssBlockText(cssText) {
  return String(cssText || '').replace(/\r\n?/g, '\n').trim();
}

function normalizeZeroCssLength(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (/^0+(?:\.0+)?(?:px|pt|pc|cm|mm|in|em|rem|%)$/.test(normalized)) {
    return '0';
  }
  return value;
}

const LOW_CONTRAST_COLOR_MAP = new Map([
  ['#969696', '#666666'],
  ['#808080', '#666666'],
  ['gray', '#666666'],
  ['grey', '#666666'],
  ['#ff3030', '#c00000']
]);

function normalizeColorToken(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function remapLowContrastColor(value) {
  const original = String(value || '').trim();
  if (!original) return original;

  const importantSuffix = /\s*!important\s*$/i.test(original) ? ' !important' : '';
  const raw = importantSuffix ? original.replace(/\s*!important\s*$/i, '').trim() : original;
  const normalized = normalizeColorToken(raw);
  const mapped = LOW_CONTRAST_COLOR_MAP.get(normalized);
  if (!mapped) return original;
  return `${mapped}${importantSuffix}`;
}

function canonicalizeInlineStyle(styleText) {
  const byProp = new Map();
  parseInlineStyle(styleText).forEach(({ prop, value }) => {
    byProp.set(prop, String(value || '').trim().replace(/\s+/g, ' '));
  });
  if (!byProp.size) return null;
  return Array.from(byProp.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([prop, value]) => `${prop}:${value}`)
    .join(';');
}

function hashStyleSignature(signature) {
  let hash = 5381;
  const text = String(signature || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function normalizeReadableClassToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildReadableExternalizedClassName(prop, value) {
  const propToken = normalizeReadableClassToken(prop);
  const valueToken = normalizeReadableClassToken(value);
  if (!propToken || !valueToken) return null;

  const className = `onc-${propToken}-${valueToken}`;
  if (className.length <= 80) return className;

  const suffix = hashStyleSignature(`${propToken}:${valueToken}`).slice(0, 8);
  return `onc-${propToken}-${valueToken.slice(0, 40)}-${suffix}`.replace(/-+$/g, '');
}

export function externalizeCss(doc, options = {}) {
  const logs = [];
  if (!doc || options.externalizeCssEnabled !== true) {
    return { logs, cssText: '' };
  }

  const extractedBlocks = [];
  const seenExtractedBlocks = new Set();
  let extractedStyleTags = 0;
  Array.from(doc.querySelectorAll('style')).forEach(styleEl => {
    const css = normalizeCssBlockText(styleEl.textContent || '');
    if (css && !seenExtractedBlocks.has(css)) {
      seenExtractedBlocks.add(css);
      extractedBlocks.push(css);
    }
    styleEl.remove();
    extractedStyleTags += 1;
  });

  const classBySignature = new Map();
  const declarationsByClass = new Map();
  let externalizedDeclarations = 0;

  Array.from(doc.querySelectorAll('[style]')).forEach(el => {
    const original = String(el.getAttribute('style') || '').trim();
    if (!original) {
      el.removeAttribute('style');
      return;
    }

    const normalized = dedupeInlineStyle(original);
    const declarations = parseInlineStyle(normalized);
    if (!declarations.length) {
      el.removeAttribute('style');
      return;
    }

    declarations.forEach(({ prop, value }) => {
      const normalizedProp = String(prop || '').trim().toLowerCase();
      const normalizedValue = normalizeCssToken(value);
      const signature = `${normalizedProp}:${normalizedValue}`;
      let className = classBySignature.get(signature);

      if (!className) {
        className = buildReadableExternalizedClassName(normalizedProp, normalizedValue) || `extcss-${hashStyleSignature(signature)}`;
        let suffix = 2;
        while (declarationsByClass.has(className) && declarationsByClass.get(className) !== signature) {
          className = `${className}-${suffix}`;
          suffix += 1;
        }
        classBySignature.set(signature, className);
        declarationsByClass.set(className, signature);
      }

      addClass(el, className);
      externalizedDeclarations += 1;
    });

    el.removeAttribute('style');
  });

  const classRules = Array.from(declarationsByClass.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([className, declaration]) => `.${className} { ${declaration}; }`);

  const cssText = [...classRules, ...extractedBlocks].join('\n\n').trim();
  if (externalizedDeclarations || extractedStyleTags) {
    logs.push({
      step: 'ExternalizeCss',
      externalizedDeclarations,
      extractedStyleTags,
      mode: String(options.externalizeCssMode || 'shared')
    });
  }

  return { logs, cssText };
}

export function normalizeUnits(doc, options = {}) {
  const logs = [];
  const strategy = String(options.unitStrategy || 'preserve').toLowerCase();
  if (strategy !== 'normalize-safe') return logs;

  const all = Array.from(doc.querySelectorAll('[style]'));
  let updated = 0;

  all.forEach(el => {
    const entries = parseInlineStyle(el.getAttribute('style'));
    if (!entries.length) return;

    const normalizedEntries = entries.map(({ prop, value }) => ({ prop, value: normalizeZeroCssLength(value) }));
    const next = serializeInlineStyle(normalizedEntries);
    const previous = String(el.getAttribute('style') || '').trim();
    if (next !== previous) {
      if (next) {
        el.setAttribute('style', next);
      } else {
        el.removeAttribute('style');
      }
      updated++;
    }
  });

  if (updated) {
    logs.push({ step: 'NormalizeUnits', strategy, updated });
  }
  return logs;
}

function normalizePositiveInteger(value, fallbackValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackValue;
  return Math.floor(parsed);
}

export function warnExcessiveInlineStyles(doc, options = {}) {
  const logs = [];
  if (!doc || typeof doc.querySelectorAll !== 'function') return logs;

  const enabled = options.enabled !== false;
  if (!enabled) return logs;

  const maxNodes = normalizePositiveInteger(options.maxNodes, 250);
  const maxChars = normalizePositiveInteger(options.maxChars, 24000);

  const nodes = Array.from(doc.querySelectorAll('[style]'));
  const inlineStyleNodeCount = nodes.length;
  let inlineStyleCharCount = 0;

  nodes.forEach((node) => {
    inlineStyleCharCount += String(node.getAttribute('style') || '').length;
  });

  const exceedsNodeThreshold = inlineStyleNodeCount > maxNodes;
  const exceedsCharThreshold = inlineStyleCharCount > maxChars;
  if (!exceedsNodeThreshold && !exceedsCharThreshold) return logs;

  logs.push({
    step: 'InlineStyleThresholdWarning',
    level: 'warn',
    details: 'Excessive inline style volume detected; output may be larger and less maintainable.',
    meta: {
      inlineStyleNodeCount,
      inlineStyleCharCount,
      maxNodes,
      maxChars,
      exceedsNodeThreshold,
      exceedsCharThreshold
    }
  });

  return logs;
}

export function stripObsoleteHeadArtifacts(doc) {
  const logs = [];

  const html = doc.querySelector('html') || doc.documentElement;
  if (html && String(html.getAttribute('xmlns') || '').trim().toLowerCase() === 'http://www.w3.org/tr/rec-html40') {
    html.removeAttribute('xmlns');
    logs.push({ step: 'StripObsoleteHeadArtifacts', details: 'Removed legacy html xmlns' });
  }

  const head = doc.querySelector('head');
  if (!head) return logs;

  const hasCharsetMeta = Boolean(head.querySelector('meta[charset]'));
  if (!hasCharsetMeta) return logs;

  const contentTypeMetas = Array.from(head.querySelectorAll('meta[http-equiv]')).filter(meta => {
    const eq = String(meta.getAttribute('http-equiv') || '').trim().toLowerCase();
    return eq === 'content-type';
  });

  if (contentTypeMetas.length) {
    contentTypeMetas.forEach(meta => meta.remove());
    logs.push({ step: 'StripObsoleteHeadArtifacts', removedContentTypeMeta: contentTypeMetas.length });
  }

  return logs;
}

export function normalizeLegacyAttributes(doc, options = {}) {
  const logs = [];
  const removeLegacyDataAttrs = options.removeLegacyDataAttrs !== false;
  let updatedStyles = 0;
  let removedListType = 0;
  let removedLegacyDataAttrs = 0;

  Array.from(doc.querySelectorAll('ul[type]')).forEach(ul => {
    const type = String(ul.getAttribute('type') || '').trim().toLowerCase();
    if (!type) return;
    ul.removeAttribute('type');
    removedListType += 1;

    if (type === 'disc') {
      addClass(ul, 'list-disc');
      addClass(ul, 'list-outside');
    } else {
      const styleEntries = parseInlineStyle(ul.getAttribute('style'));
      const hasListStyleType = styleEntries.some(({ prop }) => prop === 'list-style-type');
      if (!hasListStyleType) {
        styleEntries.push({ prop: 'list-style-type', value: type });
      }
      const next = serializeInlineStyle(styleEntries);
      if (next) ul.setAttribute('style', next);
    }
  });

  Array.from(doc.querySelectorAll('[style]')).forEach(el => {
    const original = String(el.getAttribute('style') || '').trim();
    const deduped = dedupeInlineStyle(original);
    const filteredEntries = parseInlineStyle(deduped).filter(({ prop, value }) => {
      if (prop !== 'border-width') return true;
      return String(value || '').trim() !== '100%';
    });
    const next = serializeInlineStyle(filteredEntries);
    if (next !== original) {
      if (next) {
        el.setAttribute('style', next);
      } else {
        el.removeAttribute('style');
      }
      updatedStyles += 1;
    }
  });

  if (removeLegacyDataAttrs) {
    const tableAttrs = ['data-legacy-border', 'data-legacy-cellpadding', 'data-legacy-cellspacing', 'data-legacy-align', 'data-legacy-valign'];
    Array.from(doc.querySelectorAll('table')).forEach(table => {
      tableAttrs.forEach(attr => {
        if (table.hasAttribute(attr)) {
          table.removeAttribute(attr);
          removedLegacyDataAttrs += 1;
        }
      });
    });
  }

  if (removedListType || updatedStyles || removedLegacyDataAttrs) {
    logs.push({
      step: 'NormalizeLegacyAttributes',
      removedListType,
      updatedStyles,
      removedLegacyDataAttrs
    });
  }

  return logs;
}

export function normalizeAccessibleTextContrast(doc) {
  const logs = [];
  let updatedColors = 0;

  Array.from(doc.querySelectorAll('[style]')).forEach(el => {
    const entries = parseInlineStyle(el.getAttribute('style'));
    if (!entries.length) return;

    let changed = false;
    const nextEntries = entries.map(({ prop, value }) => {
      if (prop !== 'color') return { prop, value };
      const nextValue = remapLowContrastColor(value);
      if (nextValue !== value) {
        changed = true;
        updatedColors += 1;
      }
      return { prop, value: nextValue };
    });

    if (changed) {
      const nextStyle = serializeInlineStyle(nextEntries);
      if (nextStyle) {
        el.setAttribute('style', nextStyle);
      } else {
        el.removeAttribute('style');
      }
    }
  });

  if (updatedColors) {
    logs.push({ step: 'NormalizeAccessibleTextContrast', updatedColors });
  }

  return logs;
}


function compactHeadWhitespaceNodes(head) {
  if (!head || !head.childNodes) return 0;
  let removed = 0;
  Array.from(head.childNodes).forEach((node) => {
    if (!node || node.nodeType !== 3) return;
    if (/^\s*$/.test(node.nodeValue || '')) {
      node.remove();
      removed += 1;
    }
  });
  return removed;
}

export function ensureHead(doc, options = {}) {
  const logs = [];
  let head = doc.querySelector('head');
  const html = doc.querySelector('html') || doc.documentElement;
  const body = doc.querySelector('body');
  if (!head) {
    head = doc.createElement('head');
    html.insertBefore(head, html.firstChild);
    logs.push({ step: 'EnsureHead', details: 'Inserted missing <head>' });
  }

  const compactedHeadNodes = compactHeadWhitespaceNodes(head);
  if (compactedHeadNodes) {
    logs.push({ step: 'CompactHeadWhitespace', removedTextNodes: compactedHeadNodes });
  }

  // Ensure/normalize page-level language on <html>
  const defaultLang = options.defaultLang || 'en';
  const lang = resolveDocumentLang(html, body, defaultLang);
  if (html) {
    const previous = String(html.getAttribute('lang') || '').trim();
    if (previous !== lang.value) {
      html.setAttribute('lang', lang.value);
      const action = previous ? `Normalized lang="${lang.value}" on <html>` : `Added lang="${lang.value}" to <html>`;
      logs.push({ step: 'EnsureLang', details: action, source: lang.source });
    }
  }

  // Ensure charset
  if (!head.querySelector('meta[charset]')) {
    const m = doc.createElement('meta');
    m.setAttribute('charset', 'utf-8');
    head.prepend(m);
    logs.push({ step: 'EnsureCharset', details: 'Added meta charset' });
  }

  // Ensure viewport
  if (!head.querySelector('meta[name="viewport"]')) {
    const m = doc.createElement('meta');
    m.setAttribute('name', 'viewport');
    m.setAttribute('content', 'width=device-width, initial-scale=1.0');
    head.appendChild(m);
    logs.push({ step: 'EnsureViewport', details: 'Added viewport meta' });
  }

  // Title preservation: if missing or empty, create one using defaultTitle
  let titleEl = head.querySelector('title');
  if (!titleEl) {
    titleEl = doc.createElement('title');
    titleEl.textContent = options.defaultTitle || 'Document';
    head.appendChild(titleEl);
    logs.push({ step: 'EnsureTitle', details: 'Added default title' });
  } else if (!titleEl.textContent || !titleEl.textContent.trim()) {
    titleEl.textContent = options.defaultTitle || 'Document';
    logs.push({ step: 'EnsureTitle', details: 'Set title text to default title' });
  }

  return logs;
}

export function removeOneNoteMeta(doc) {
  const logs = [];
  // Remove meta tags or comments that look like OneNote/Word cruft
  const metas = Array.from(doc.querySelectorAll('meta')).filter(m =>
    /one|mso|generator/i.test(m.getAttribute('name') || '') ||
    /mso|word|onenote/i.test(m.getAttribute('content') || '')
  );
  metas.forEach(m => m.remove());
  if (metas.length) logs.push({ step: 'RemoveOneNoteMeta', removed: metas.length });
  return logs;
}

// remove various Office/OneNote artifacts such as mso- attributes, xmlns:*
// declarations, and `mso-spacerun` spans. The output should retain all
// meaningful text/content while stripping structural cruft that bloats the
// document and may confuse downstream sanitizers.
export function removeOfficeArtifacts(doc) {
  const logs = [];
  const all = Array.from(doc.querySelectorAll('*'));
  all.forEach(el => {
    // remove unwanted attributes
    for (const { name, value } of Array.from(el.attributes)) {
      if (/^(mso-|o:|v:|w:|xmlns:)/i.test(name)) {
        el.removeAttribute(name);
        logs.push({ step: 'RemoveAttr', tag: el.tagName, attr: name });
      }
      if (name.toLowerCase() === 'xmlns' && OFFICE_NS_RE.test(String(value || ''))) {
        el.removeAttribute('xmlns');
        logs.push({ step: 'RemoveAttr', tag: el.tagName, attr: 'xmlns' });
      }
      if (name.toLowerCase() === 'summary' && el.tagName.toLowerCase() !== 'table') {
        el.removeAttribute('summary');
        logs.push({ step: 'RemoveAttr', tag: el.tagName, attr: 'summary' });
      }
      // also drop class names beginning with Mso (Office classes)
      if (name === 'class') {
        const cls = el.getAttribute('class');
        if (/\bMso/i.test(cls)) {
          el.removeAttribute('class');
          logs.push({ step: 'RemoveClass', tag: el.tagName, details: cls });
        }
      }
    }
    // scrub style attribute value for mso- declarations
    if (el.hasAttribute('style')) {
      const style = el.getAttribute('style');
      const cleaned = style.split(';').filter(s => !/mso-/i.test(s)).join(';');
      if (cleaned !== style) {
        el.setAttribute('style', cleaned);
        logs.push({ step: 'CleanStyle', tag: el.tagName });
      }
    }

    // strip mso-spacerun spans by replacing with their text (usually a space)
    if (el.nodeType === 1) {
      const style = el.getAttribute('style') || '';
      if (/mso-spacerun\s*:\s*yes/i.test(style)) {
        const txt = doc.createTextNode(el.textContent || ' ');
        el.replaceWith(txt);
        logs.push({ step: 'RemoveSpacerun', tag: el.tagName });
        return; // element gone
      }
    }

    // drop <link rel="Main-File"> or "File-List"
    if (el.tagName.toLowerCase() === 'link') {
      const rel = (el.getAttribute('rel') || '').toLowerCase();
      if (rel === 'main-file' || rel === 'file-list') {
        el.remove();
        logs.push({ step: 'RemoveLink', details: rel });
        return;
      }
    }

    // collapse bullet-marker spans (some OneNote HTML wraps bullets in <span>)
    if (el.tagName.toLowerCase() === 'span') {
      const txt = el.textContent.trim();
      if (/^[\u2022\u2023\u25AA\u25E6•·]$/.test(txt)) {
        const tnode = doc.createTextNode(txt);
        el.replaceWith(tnode);
        logs.push({ step: 'FlattenBullet', details: txt });
      }
    }
  });
  return logs;
}

// normalize/remove obsolete or presentational table attributes
export function normalizeTableAttributes(doc, options = {}) {
  const logs = [];

  Array.from(doc.querySelectorAll('table')).forEach(tbl => {
    const removed = [];
    // summary handling
    if (tbl.hasAttribute('summary')) {
      const val = tbl.getAttribute('summary');
      if (!String(val || '').trim() || /^mso-/i.test(val) || OFFICE_NS_RE.test(val)) {
        tbl.removeAttribute('summary');
        removed.push('summary');
      } else {
        // keep value for review/accessibility
        tbl.setAttribute('data-legacy-summary', val);
        tbl.removeAttribute('summary');
        logs.push({ step: 'NormalizeTableAttr', tag: 'TABLE', action: 'movedSummary', value: val });
      }
    }
    // presentational attrs
    ['border','cellpadding','cellspacing','align','valign'].forEach(a => {
      if (tbl.hasAttribute(a)) {
        const v = tbl.getAttribute(a);
        tbl.removeAttribute(a);
        removed.push(a);
        tbl.setAttribute(`data-legacy-${a}`, v);
      }
    });
    // bare xmlns removal when Office-related
    if (tbl.hasAttribute('xmlns')) {
      const ns = tbl.getAttribute('xmlns');
      if (OFFICE_NS_RE.test(ns)) {
        tbl.removeAttribute('xmlns');
        removed.push('xmlns');
      }
    }

    if (tbl.hasAttribute('title') && !String(tbl.getAttribute('title') || '').trim()) {
      tbl.removeAttribute('title');
      removed.push('title');
    }

    if (tbl.hasAttribute('data-legacy-summary') && !String(tbl.getAttribute('data-legacy-summary') || '').trim()) {
      tbl.removeAttribute('data-legacy-summary');
      removed.push('data-legacy-summary');
    }

    if (removed.length) logs.push({ step: 'NormalizeTableAttr', tag: 'TABLE', removed });
  });
  return logs;
}

// In converted OneNote tables, paragraph margins are often omitted on <p>
// while equivalent cells use margin:0. Browser default <p> margins then make
// some rows taller. Normalize missing margins inside table cells to preserve
// author-chosen row heights.
export function normalizeTableCellParagraphMargins(doc) {
  const logs = [];
  const paragraphs = Array.from(doc.querySelectorAll('table td > p, table th > p'));
  let updated = 0;

  paragraphs.forEach((paragraph) => {
    const styleText = String(paragraph.getAttribute('style') || '');
    const entries = parseInlineStyle(styleText);
    const hasMargin = entries.some(({ prop }) => prop === 'margin');
    const hasMarginTop = entries.some(({ prop }) => prop === 'margin-top');
    const hasMarginBottom = entries.some(({ prop }) => prop === 'margin-bottom');
    if (hasMargin || hasMarginTop || hasMarginBottom) return;

    entries.push({ prop: 'margin', value: '0' });
    const nextStyle = serializeInlineStyle(entries);
    paragraph.setAttribute('style', nextStyle);
    updated += 1;
  });

  if (updated) {
    logs.push({ step: 'NormalizeTableCellParagraphMargins', updated });
  }

  return logs;
}

export function sanitizeImageAttributes(doc) {
  const logs = [];
  const imgs = Array.from(doc.querySelectorAll('img'));
  let cleaned = 0;
  imgs.forEach(img => {
    // Quote numeric width/height by ensuring attributes are strings
    const w = img.getAttribute('width');
    const h = img.getAttribute('height');
    if (w !== null && w.trim() === '') { img.removeAttribute('width'); cleaned++; }
    if (h !== null && h.trim() === '') { img.removeAttribute('height'); cleaned++; }
    // Remove MSO inline styles that break responsiveness
    const style = img.getAttribute('style') || '';
    if (/mso-/i.test(style)) {
      const newStyle = style.split(';').filter(s => !/mso-/i.test(s)).join(';');
      img.setAttribute('style', newStyle);
      cleaned++;
    }
  });
  if (cleaned) logs.push({ step: 'SanitizeImages', cleaned });
  return logs;
}

function isDecorativeImage(img) {
  const role = String(img.getAttribute('role') || '').trim().toLowerCase();
  const ariaHidden = String(img.getAttribute('aria-hidden') || '').trim().toLowerCase();
  return role === 'presentation' || role === 'none' || ariaHidden === 'true';
}

function isLikelyHandwritingRasterImage(img) {
  const alt = String(img.getAttribute('alt') || '').trim().toLowerCase();
  const ariaLabel = String(img.getAttribute('aria-label') || '').trim().toLowerCase();
  const title = String(img.getAttribute('title') || '').trim().toLowerCase();
  const src = String(img.getAttribute('src') || '').trim().toLowerCase();
  const signalText = [alt, ariaLabel, title, src].filter(Boolean).join(' ');
  return /\b(ink|handwrit|ink\s+drawings?)\b/.test(signalText);
}

function countVmlElements(doc) {
  const all = Array.from(doc.querySelectorAll('*'));
  let count = 0;
  all.forEach((node) => {
    const tagName = String(node.tagName || '').toLowerCase();
    const namespaceUri = String(node.namespaceURI || '').toLowerCase();
    if (tagName.startsWith('v:') || tagName.startsWith('o:')) {
      count += 1;
      return;
    }
    if (namespaceUri.includes('vml') || namespaceUri.includes('office')) {
      count += 1;
    }
  });
  return count;
}

export function annotateHandwritingAssets(doc, options = {}) {
  const logs = [];
  if (!doc || typeof doc.querySelectorAll !== 'function') return logs;

  const enabled = options.enabled !== false;
  if (!enabled) return logs;

  const rasterAlt = typeof options.rasterAltText === 'string' && options.rasterAltText.trim()
    ? options.rasterAltText.trim()
    : 'Handwritten notes (raster image)';

  const svgCount = doc.querySelectorAll('svg').length;
  const canvasCount = doc.querySelectorAll('canvas').length;
  const vmlCount = countVmlElements(doc);
  const rasterCandidates = Array.from(doc.querySelectorAll('img')).filter(isLikelyHandwritingRasterImage);
  const rasterCandidateCount = rasterCandidates.length;
  const rasterOnly = rasterCandidateCount > 0 && svgCount === 0 && canvasCount === 0 && vmlCount === 0;

  let annotated = 0;
  let altUpdated = 0;
  let decorativeSkipped = 0;

  if (rasterOnly) {
    rasterCandidates.forEach((img) => {
      img.setAttribute('data-handwriting', 'raster');
      annotated += 1;
      if (isDecorativeImage(img)) {
        decorativeSkipped += 1;
        return;
      }
      if (img.getAttribute('alt') !== rasterAlt) {
        img.setAttribute('alt', rasterAlt);
        altUpdated += 1;
      }
    });
  }

  if (svgCount || canvasCount || vmlCount || rasterCandidateCount || annotated || altUpdated || decorativeSkipped) {
    logs.push({
      step: 'DetectHandwritingAssets',
      level: rasterOnly ? 'warn' : 'info',
      details: rasterOnly
        ? 'Raster-only handwriting assets detected; applied handwriting metadata and accessibility labels.'
        : 'Handwriting asset scan complete.',
      meta: {
        svgCount,
        canvasCount,
        vmlCount,
        rasterCandidateCount,
        rasterOnly,
        annotated,
        altUpdated,
        decorativeSkipped
      }
    });
  }

  return logs;
}

export function ensureImageAlt(doc, options = {}) {
  const logs = [];
  const imgs = Array.from(doc.querySelectorAll('img'));
  const fallbackAlt = typeof options.fallbackAlt === 'string' && options.fallbackAlt.trim()
    ? options.fallbackAlt.trim()
    : 'Image';

  let updated = 0;
  let decorativeSkipped = 0;

  imgs.forEach(img => {
    const isDecorative = isDecorativeImage(img);
    if (isDecorative) {
      decorativeSkipped++;
      return;
    }

    const alt = img.getAttribute('alt');
    if (alt === null || !String(alt).trim()) {
      img.setAttribute('alt', fallbackAlt);
      updated++;
    }
  });

  if (updated || decorativeSkipped) {
    logs.push({ step: 'EnsureImageAlt', updated, decorativeSkipped });
  }
  return logs;
}

export function removeNbsp(doc) {
  const logs = [];
  if (!doc || typeof doc.createTreeWalker !== 'function') {
    return logs;
  }

  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let updated = 0;

  while (node) {
    const value = node.nodeValue;
    if (value && value.indexOf('\u00a0') !== -1) {
      const parent = node.parentElement;
      const isWhitespaceOnly = String(value).replace(/[\u00a0\s]/g, '') === '';
      const preserveSpacerNbsp = Boolean(
        parent
        && /^(p|div|blockquote|li)$/i.test(String(parent.tagName || ''))
        && isWhitespaceOnly
        && parent.childNodes
        && parent.childNodes.length === 1
      );

      if (preserveSpacerNbsp) {
        // Keep one NBSP so intentionally blank block lines retain visible height.
        node.nodeValue = '\u00a0';
      } else {
        node.nodeValue = value.replace(/\u00a0/g, ' ');
      }
      updated++;
    }
    node = walker.nextNode();
  }

  if (updated) logs.push({ step: 'RemoveNbsp', updated });
  return logs;
}

function cleanInlineText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function isCreatedWithOneNoteFooterText(text) {
  return /^created with onenote\.?$/i.test(cleanInlineText(text));
}

function isVisualSpacerElement(el) {
  if (!el || !el.tagName) return false;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag === 'br') return true;
  if (tag !== 'p' && tag !== 'div') return false;
  // Some OneNote pages use image-only paragraphs (for example icon rows).
  // Treat those as content so trailing spacer cleanup does not remove them.
  if (el.querySelector && el.querySelector('img,svg,canvas,picture,video,audio,iframe,object,embed,table,ul,ol,pre,code')) {
    return false;
  }
  return cleanInlineText(el.textContent || '') === '';
}

function isWhitespaceOnlyParagraphLike(el) {
  if (!el || !el.tagName) return false;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag !== 'p' && tag !== 'div' && tag !== 'blockquote') return false;
  if (el.querySelector && el.querySelector(':scope > br')) return true;
  const text = String(el.textContent || '');
  if (!text) return true;
  return text.replace(/[\u00a0\s]/g, '') === '';
}

function getTableRows(table) {
  if (!table || !table.querySelectorAll) return [];
  const bodyRows = Array.from(table.querySelectorAll(':scope > tbody > tr'));
  if (bodyRows.length) return bodyRows;
  return Array.from(table.querySelectorAll(':scope > tr'));
}

function getRowCells(row) {
  if (!row || !row.querySelectorAll) return [];
  return Array.from(row.querySelectorAll(':scope > th, :scope > td'));
}

function normalizeInlineText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function detectSemanticTableColumnIndexes(table) {
  const rows = getTableRows(table);
  if (!rows.length) return null;

  const firstCells = getRowCells(rows[0]);
  if (firstCells.length < 2) return null;

  let cueIndex = -1;
  let notesIndex = -1;
  firstCells.forEach((cell, index) => {
    const text = normalizeInlineText(cell.textContent || '');
    if (cueIndex === -1 && /\bcue(s)?\b/.test(text)) cueIndex = index;
    if (notesIndex === -1 && /\bnote(s)?\b/.test(text)) notesIndex = index;
  });

  if (cueIndex === -1) cueIndex = 0;
  if (notesIndex === -1) notesIndex = 1;
  if (cueIndex === notesIndex) return null;

  return { cueIndex, notesIndex };
}

function getInlineStyleValue(el, propName) {
  if (!el || !propName) return '';
  const targetProp = String(propName || '').trim().toLowerCase();
  const entry = parseInlineStyle(el.getAttribute('style') || '').find(({ prop }) => String(prop || '').trim().toLowerCase() === targetProp);
  return entry ? String(entry.value || '') : '';
}

function hasContentSizedBlankLineTypography(el) {
  if (!el) return false;

  const classNames = String(el.getAttribute('class') || '');
  if (/\b(?:font-sans|text-base|onc-copy|onc-title|onc-h1|onc-h2|onc-h3|onc-cite)\b/i.test(classNames)) {
    return true;
  }

  const fontSize = normalizeCssToken(getInlineStyleValue(el, 'font-size')).toLowerCase();
  const match = fontSize.match(/^([0-9]+(?:\.[0-9]+)?)(pt|px)$/i);
  if (!match) return false;

  const size = Number(match[1]);
  const unit = String(match[2] || '').toLowerCase();
  if (!Number.isFinite(size)) return false;
  return unit === 'pt' ? size >= 8 : size >= 10;
}

function shouldNormalizeTableBlankLineSpacer(el) {
  if (!el || typeof el.closest !== 'function') return false;
  const detailCell = el.closest('td[data-onc-col-role="detail"],th[data-onc-col-role="detail"],td,th');
  if (!detailCell) return false;

  const row = detailCell.parentElement;
  const table = detailCell.closest('table');
  if (!row || !table) return false;

  const classifiedColumns = detectSemanticTableColumnIndexes(table);
  if (!classifiedColumns) return false;

  const cellIndex = getRowCells(row).indexOf(detailCell);
  if (cellIndex !== classifiedColumns.notesIndex) return false;

  return hasContentSizedBlankLineTypography(el);
}

function ensureVisibleSpacerBlock(el, doc) {
  if (!el || !el.tagName) return false;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag !== 'p' && tag !== 'div') return false;
  if (cleanInlineText(el.textContent || '') !== '') return false;
  let changed = false;

  // Normalize spacer to a compact visible block: use a class-based
  // spacer so we avoid adding inline `style` attributes that test
  // suites treat as forbidden. The visual size is driven by a small
  // stylesheet injected into the document head.
  if (el.querySelector && !el.querySelector(':scope > br')) {
    el.textContent = '';
    const b = doc.createElement('br');
    el.appendChild(b);
    changed = true;
  }
  const beforeClass = String(el.getAttribute('class') || '');
  addClass(el, 'converted-page-spacer');
  if (String(el.getAttribute('class') || '') !== beforeClass) changed = true;
  return changed;
}

function isContainerElement(el) {
  if (!el || !el.tagName) return false;
  return /^(div|section|article|main|aside|blockquote|li|td|th)$/i.test(String(el.tagName || ''));
}

function trimTrailingVisualSpacersDeep(root) {
  if (!root || !root.lastElementChild) return 0;
  let removed = 0;

  while (root.lastElementChild) {
    const last = root.lastElementChild;
    if (isVisualSpacerElement(last)) {
      last.remove();
      removed += 1;
      continue;
    }

    if (isContainerElement(last)) {
      const nestedRemoved = trimTrailingVisualSpacersDeep(last);
      removed += nestedRemoved;
      if (nestedRemoved > 0) {
        continue;
      }
    }

    break;
  }

  return removed;
}

export function injectFooterSpacerCss(doc) {
  if (!doc) return [];
  const head = doc.querySelector('head') || doc.documentElement;
  const existing = head.querySelector('style[data-converted-spacer]');
  if (existing) return [];
  const style = doc.createElement('style');
  style.setAttribute('data-converted-spacer', '1');
  style.appendChild(doc.createTextNode('.converted-page-spacer{margin:0;line-height:0.95;font-size:1em;}.converted-content-spacer{margin:0;line-height:1;font-size:1em;}'));
  head.appendChild(style);
  return [{ step: 'InjectFooterSpacerCss', details: 'Inserted compact spacer stylesheet' }];
}

const COMPACT_TYPOGRAPHY_PATTERNS = [
  {
    className: 'onc-body',
      cssText: 'font-family:Calibri;font-size:11.0pt;background-color:transparent;color:initial;',
    selector: 'body',
    requiredClasses: ['font-sans', 'text-base'],
    removableClasses: ['font-sans', 'text-base'],
    removableStyleProps: ['font-family', 'font-size'],
    requiredStyles: {
      'font-family': 'Calibri',
      'font-size': '11.0pt'
    }
  },
  {
    className: 'onc-copy',
    cssText: 'margin:0;font-family:Calibri;font-size:11.0pt;',
    requiredClasses: ['font-sans', 'text-base'],
    removableClasses: ['font-sans', 'text-base'],
    removableStyleProps: ['margin', 'font-family', 'font-size'],
    requiredStyles: {
      margin: '0',
      'font-family': 'Calibri',
      'font-size': '11.0pt'
    }
  },
  {
    className: 'onc-meta',
    cssText: 'margin:0;font-family:Calibri,Arial,sans-serif;font-size:10pt;',
    requiredClasses: ['font-sans', 'text-sm'],
    removableClasses: ['font-sans', 'text-sm'],
    removableStyleProps: ['margin', 'font-family', 'font-size'],
    requiredStyles: {
      margin: '0',
      'font-family': 'Calibri, Arial, sans-serif',
      'font-size': '10pt'
    }
  },
  {
    className: 'onc-title',
    cssText: 'margin:0;font-family:"Calibri Light";font-size:20pt;font-weight:400;',
    requiredClasses: ['font-sans', 'text-xl'],
    removableClasses: ['font-sans', 'text-xl', 'font-normal'],
    removableStyleProps: ['margin', 'font-family', 'font-size', 'font-weight'],
    requiredStyles: {
      margin: '0',
      'font-family': ['"Calibri Light"', 'Calibri Light'],
      'font-size': ['20pt', '20.0pt']
    }
  },
  {
    className: 'onc-h1',
    cssText: 'margin:0;font-family:Calibri;font-size:16.0pt;',
    requiredClasses: ['font-sans', 'text-xl'],
    removableClasses: ['font-sans', 'text-xl'],
    removableStyleProps: ['margin', 'font-family', 'font-size'],
    requiredStyles: {
      margin: '0',
      'font-family': 'Calibri',
      'font-size': '16.0pt'
    }
  },
  {
    className: 'onc-h2',
    cssText: 'margin:0;font-family:Calibri;font-size:14.0pt;',
    requiredClasses: ['font-sans', 'text-lg'],
    removableClasses: ['font-sans', 'text-lg'],
    removableStyleProps: ['margin', 'font-family', 'font-size'],
    requiredStyles: {
      margin: '0',
      'font-family': 'Calibri',
      'font-size': '14.0pt'
    }
  },
  {
    className: 'onc-h3',
    cssText: 'margin:0;font-family:Calibri;font-size:12.0pt;',
    requiredClasses: ['font-sans', 'text-base'],
    removableClasses: ['font-sans', 'text-base'],
    removableStyleProps: ['margin', 'font-family', 'font-size'],
    requiredStyles: {
      margin: '0',
      'font-family': 'Calibri',
      'font-size': '12.0pt'
    }
  },
  {
    className: 'onc-cite',
    cssText: 'margin:0;font-family:Calibri;font-size:9.0pt;',
    requiredClasses: ['font-sans', 'text-xs'],
    removableClasses: ['font-sans', 'text-xs'],
    removableStyleProps: ['margin', 'font-family', 'font-size'],
    requiredStyles: {
      margin: '0',
      'font-family': 'Calibri',
      'font-size': '9.0pt'
    }
  },
  {
    className: 'onc-list',
    cssText: 'direction:ltr;unicode-bidi:embed;margin-top:0;margin-bottom:0;font-family:Calibri;font-size:11.0pt;font-weight:400;font-style:normal;margin-left:0.35em;padding-left:1.2em;padding-inline-start:1.2em;',
    selector: 'ol',
    requiredClasses: ['font-sans', 'text-base', 'font-normal'],
    removableClasses: ['mt-0', 'mb-0', 'font-sans', 'text-base', 'font-normal'],
    removableStyleProps: ['direction', 'unicode-bidi', 'margin-top', 'margin-bottom', 'font-family', 'font-size', 'font-weight', 'font-style', 'margin-left', 'padding-left', 'padding-inline-start'],
    requiredStyles: {
      direction: 'ltr',
      'unicode-bidi': 'embed',
      'margin-top': '0',
      'margin-bottom': '0',
      'font-family': 'Calibri',
      'font-size': '11.0pt',
      'font-weight': ['normal', '400'],
      'font-style': 'normal',
      'margin-left': '0.35em',
      'padding-left': '1.2em',
      'padding-inline-start': '1.2em'
    }
  },
  {
    className: 'onc-list-strong',
    cssText: 'direction:ltr;unicode-bidi:embed;margin-top:0;margin-bottom:0;font-family:Calibri;font-size:11.0pt;font-weight:700;font-style:normal;margin-left:0.35em;padding-left:1.2em;padding-inline-start:1.2em;',
    selector: 'ol',
    requiredClasses: ['font-sans', 'text-base'],
    removableClasses: ['mt-0', 'mb-0', 'font-sans', 'text-base', 'font-bold'],
    removableStyleProps: ['direction', 'unicode-bidi', 'margin-top', 'margin-bottom', 'font-family', 'font-size', 'font-weight', 'font-style', 'margin-left', 'padding-left', 'padding-inline-start'],
    requiredStyles: {
      direction: 'ltr',
      'unicode-bidi': 'embed',
      'margin-top': '0',
      'margin-bottom': '0',
      'font-family': 'Calibri',
      'font-size': '11.0pt',
      'font-weight': ['bold', '700'],
      'font-style': 'normal',
      'margin-left': '0.35em',
      'padding-left': '1.2em',
      'padding-inline-start': '1.2em'
    }
  },
  {
    className: 'onc-list-item-strong',
    cssText: 'margin-top:0;margin-bottom:0;vertical-align:middle;font-weight:700;',
    selector: 'li',
    removableClasses: ['font-bold'],
    removableStyleProps: ['margin-top', 'margin-bottom', 'vertical-align', 'font-weight'],
    requiredStyles: {
      'margin-top': '0',
      'margin-bottom': '0',
      'vertical-align': 'middle',
      'font-weight': ['bold', '700']
    }
  },
  {
    className: 'onc-list-item',
    cssText: 'margin-top:0;margin-bottom:0;vertical-align:middle;',
    selector: 'li',
    removableClasses: ['mt-0', 'mb-0'],
    removableStyleProps: ['margin-top', 'margin-bottom', 'vertical-align'],
    requiredStyles: {
      'margin-top': '0',
      'margin-bottom': '0',
      'vertical-align': 'middle'
    }
  },
  {
    className: 'onc-bullet-list',
    cssText: 'direction:ltr;unicode-bidi:embed;margin-top:0;margin-bottom:0;margin-left:0.35em;padding-left:1.2em;padding-inline-start:1.2em;',
    selector: 'ul',
    requiredClasses: ['list-disc', 'list-outside', 'mb-0'],
    removableClasses: ['mt-0', 'mb-0'],
    removableStyleProps: ['direction', 'unicode-bidi', 'margin-top', 'margin-bottom', 'margin-left', 'padding-left', 'padding-inline-start'],
    requiredStyles: {
      direction: 'ltr',
      'unicode-bidi': 'embed',
      'margin-top': '0',
      'margin-bottom': '0',
      'margin-left': '0.35em',
      'padding-left': '1.2em',
      'padding-inline-start': '1.2em'
    }
  },
  {
    className: 'onc-inline-copy',
    cssText: 'font-family:Calibri;font-size:11.0pt;font-weight:400;font-style:normal;',
    selector: 'span',
    requiredClasses: ['font-sans', 'text-base', 'font-normal'],
    removableClasses: ['font-sans', 'text-base', 'font-normal'],
    removableStyleProps: ['font-family', 'font-size', 'font-weight', 'font-style'],
    requiredStyles: {
      'font-family': 'Calibri',
      'font-size': '11.0pt',
      'font-weight': ['normal', '400'],
      'font-style': 'normal'
    }
  },
  {
    className: 'onc-inline-copy-reset',
    cssText: 'font-family:Calibri;font-size:11.0pt;font-weight:400;',
    selector: 'span',
    requiredClasses: ['font-sans', 'text-base', 'font-normal'],
    removableClasses: ['font-sans', 'text-base', 'font-normal'],
    removableStyleProps: ['font-family', 'font-size', 'font-weight'],
    requiredStyles: {
      'font-family': 'Calibri',
      'font-size': '11.0pt',
      'font-weight': ['normal', '400']
    }
  },
  {
    className: 'onc-inline-copy-lite',
    cssText: 'font-family:Calibri;font-size:11.0pt;',
    selector: 'span',
    requiredClasses: ['font-sans', 'text-base'],
    removableClasses: ['font-sans', 'text-base'],
    removableStyleProps: ['font-family', 'font-size'],
    requiredStyles: {
      'font-family': 'Calibri',
      'font-size': '11.0pt'
    }
  }
];

const COMPACT_LAYOUT_PATTERNS = [
  {
    className: 'onc-table-borderless',
    cssText: 'border-collapse:collapse;border-style:solid;border-color:#A3A3A3;border-width:0;',
    removableStyleProps: ['border-collapse', 'border-style', 'border-color', 'border-width'],
    requiredStyles: {
      'border-collapse': 'collapse',
      'border-style': 'solid',
      'border-color': '#A3A3A3',
      'border-width': '0'
    }
  },
  {
    className: 'onc-table',
    cssText: 'border-collapse:collapse;border-style:solid;border-color:#A3A3A3;border-width:1pt;',
    removableStyleProps: ['border-collapse', 'border-style', 'border-color', 'border-width'],
    requiredStyles: {
      'border-collapse': 'collapse',
      'border-style': 'solid',
      'border-color': '#A3A3A3',
      'border-width': '1pt'
    }
  },
  {
    className: 'onc-cell-borderless',
    cssText: 'border-style:solid;border-color:#A3A3A3;border-width:0;vertical-align:top;padding:2.0pt 3.0pt 2.0pt 3.0pt;',
    removableStyleProps: ['border-style', 'border-color', 'border-width', 'vertical-align', 'padding'],
    requiredStyles: {
      'border-style': 'solid',
      'border-color': '#A3A3A3',
      'border-width': '0',
      'vertical-align': 'top',
      padding: '2.0pt 3.0pt 2.0pt 3.0pt'
    }
  },
  {
    className: 'onc-cell-borderless-lite',
    cssText: 'border-width:0;vertical-align:top;padding:2.0pt 3.0pt 2.0pt 3.0pt;',
    removableStyleProps: ['border-width', 'vertical-align', 'padding'],
    requiredStyles: {
      'border-width': '0',
      'vertical-align': 'top',
      padding: '2.0pt 3.0pt 2.0pt 3.0pt'
    }
  },
  {
    className: 'onc-cell',
    cssText: 'border-style:solid;border-color:#A3A3A3;border-width:1pt;vertical-align:top;padding:2.0pt 3.0pt 2.0pt 3.0pt;',
    removableStyleProps: ['border-style', 'border-color', 'border-width', 'vertical-align', 'padding'],
    requiredStyles: {
      'border-style': 'solid',
      'border-color': '#A3A3A3',
      'border-width': '1pt',
      'vertical-align': 'top',
      padding: '2.0pt 3.0pt 2.0pt 3.0pt'
    }
  },
  {
    className: 'onc-center',
    cssText: 'text-align:center;',
    removableStyleProps: ['text-align'],
    requiredStyles: {
      'text-align': 'center'
    }
  },
  {
    className: 'onc-right',
    cssText: 'text-align:right;',
    removableStyleProps: ['text-align'],
    requiredStyles: {
      'text-align': 'right'
    }
  }
];

const RESIDUAL_COMPACT_PATTERNS = [
  {
    className: 'onc-page-title',
    selector: 'h1',
    cssText: 'display:inline-block;padding-right:1in;padding-bottom:0.08em;border-bottom:1px solid #b7b7b7;',
    requiredClasses: ['converted-page-title', 'onc-title'],
    removableStyleProps: ['display', 'padding-right', 'padding-bottom', 'border-bottom'],
    requiredStyles: {
      display: 'inline-block',
      'padding-right': '1in',
      'padding-bottom': '0.08em',
      'border-bottom': '1px solid #b7b7b7'
    }
  },
  {
    className: 'onc-page-date-tone',
    selector: 'p',
    cssText: 'color:#666666;',
    requiredClasses: ['converted-page-date', 'onc-meta'],
    removableStyleProps: ['color'],
    requiredStyles: {
      color: '#666666'
    }
  },
  {
    className: 'onc-page-time',
    selector: 'span',
    cssText: 'color:#666666;margin-left:0.75em;',
    requiredClasses: ['created-time', 'converted-page-time', 'onc-meta'],
    removableStyleProps: ['color', 'margin-left'],
    requiredStyles: {
      color: '#666666',
      'margin-left': '0.75em'
    }
  }
];

const REDUNDANT_UTILITY_PRUNE_RULES = [
  {
    className: 'mt-6',
    requiredStyles: {
      'margin-top': '2rem'
    }
  },
  {
    className: 'mt-0',
    requiredStyles: {
      'margin-top': '0'
    }
  },
  {
    className: 'font-bold',
    requiredStyles: {
      'font-weight': ['bold', '700']
    }
  }
];

function getClassNameSet(el) {
  return new Set(String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean));
}

function removeClassNames(el, classNames = []) {
  const next = Array.from(getClassNameSet(el)).filter((name) => !classNames.includes(name));
  if (next.length) {
    el.setAttribute('class', next.join(' '));
    return;
  }
  el.removeAttribute('class');
}

function hasRequiredClasses(el, requiredClasses = []) {
  const classSet = getClassNameSet(el);
  return requiredClasses.every((name) => classSet.has(name));
}

function hasRequiredStyles(el, requiredStyles = {}) {
  const styleMap = new Map();
  parseInlineStyle(el.getAttribute('style') || '').forEach(({ prop, value }) => {
    styleMap.set(String(prop || '').trim().toLowerCase(), normalizeCssToken(value));
  });

  return Object.entries(requiredStyles).every(([prop, value]) => {
    const actual = styleMap.get(String(prop).trim().toLowerCase());
    const expectedValues = Array.isArray(value) ? value : [value];
    return expectedValues.some((entry) => actual === normalizeCssToken(entry));
  });
}

function ensureCompactTypographyStyle(doc, usedPatternClassNames = []) {
  const head = doc.querySelector('head') || doc.documentElement;
  if (!head) return false;
  if (head.querySelector('style[data-onc-compact-typography]')) return false;

  const allPatterns = [...COMPACT_TYPOGRAPHY_PATTERNS, ...COMPACT_LAYOUT_PATTERNS, ...RESIDUAL_COMPACT_PATTERNS];
  const requested = new Set((usedPatternClassNames || []).map((name) => String(name || '').trim()).filter(Boolean));
  const patterns = requested.size
    ? allPatterns.filter((pattern) => requested.has(pattern.className))
    : allPatterns;
  if (!patterns.length) return false;

  const style = doc.createElement('style');
  style.setAttribute('data-onc-compact-typography', '1');
  style.appendChild(doc.createTextNode(patterns.map((pattern) => `.${pattern.className}{${pattern.cssText}}`).join('\n')));
  head.appendChild(style);
  return true;
}

function removeMatchedStyleDeclarations(el, removableStyleProps = []) {
  if (!el || !removableStyleProps.length) return false;
  const styleText = el.getAttribute('style') || '';
  const declarations = parseInlineStyle(styleText);
  if (!declarations.length) return false;

  const removable = new Set(removableStyleProps.map((prop) => String(prop || '').trim().toLowerCase()));
  const kept = declarations.filter(({ prop }) => !removable.has(String(prop || '').trim().toLowerCase()));
  if (kept.length === declarations.length) return false;

  const nextStyle = serializeInlineStyle(kept);
  if (nextStyle) {
    el.setAttribute('style', nextStyle);
  } else {
    el.removeAttribute('style');
  }
  return true;
}

function applyCompactPatterns(nodes, patterns, usedPatternClassNames) {
  let replacements = 0;
  let strippedStyleDeclarations = 0;

  nodes.forEach((node) => {
    const match = patterns.find((pattern) => {
      if (pattern.selector && !node.matches(pattern.selector)) return false;
      return hasRequiredClasses(node, pattern.requiredClasses) && hasRequiredStyles(node, pattern.requiredStyles);
    });
    if (!match) return;

    addClass(node, match.className);
    usedPatternClassNames.add(match.className);
    removeClassNames(node, match.removableClasses);
    if (removeMatchedStyleDeclarations(node, match.removableStyleProps || [])) {
      strippedStyleDeclarations += 1;
    }
    replacements += 1;
  });

  return { replacements, strippedStyleDeclarations };
}

function cleanupRedundantAttributes(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return {
      emptyStyleRemoved: 0,
      emptyClassRemoved: 0,
      classAttributesDeduped: 0
    };
  }

  let emptyStyleRemoved = 0;
  let emptyClassRemoved = 0;
  let classAttributesDeduped = 0;

  Array.from(doc.querySelectorAll('[style],[class]')).forEach((node) => {
    if (node.hasAttribute('style')) {
      const declarations = parseInlineStyle(node.getAttribute('style') || '');
      if (!declarations.length) {
        node.removeAttribute('style');
        emptyStyleRemoved += 1;
      }
    }

    if (!node.hasAttribute('class')) return;

    const tokens = String(node.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      node.removeAttribute('class');
      emptyClassRemoved += 1;
      return;
    }

    const uniqueTokens = [];
    const seen = new Set();
    tokens.forEach((token) => {
      if (seen.has(token)) return;
      seen.add(token);
      uniqueTokens.push(token);
    });

    if (uniqueTokens.length !== tokens.length || uniqueTokens.join(' ') !== node.getAttribute('class')) {
      node.setAttribute('class', uniqueTokens.join(' '));
      classAttributesDeduped += 1;
    }
  });

  return {
    emptyStyleRemoved,
    emptyClassRemoved,
    classAttributesDeduped
  };
}

function parseCssLengthToInches(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  const match = text.match(/^([+-]?[0-9]*\.?[0-9]+)\s*(in|pt|px|pc|cm|mm)$/i);
  if (!match) return null;
  const magnitude = Number.parseFloat(match[1]);
  if (!Number.isFinite(magnitude)) return null;
  const unit = String(match[2] || '').toLowerCase();
  switch (unit) {
    case 'in':
      return magnitude;
    case 'pt':
      return magnitude / 72;
    case 'px':
      return magnitude / 96;
    case 'pc':
      return magnitude / 6;
    case 'cm':
      return magnitude / 2.54;
    case 'mm':
      return magnitude / 25.4;
    default:
      return null;
  }
}

function cellUsesCompactTableLayoutClass(cell) {
  if (!cell || !cell.classList) return false;
  return cell.classList.contains('onc-cell')
    || cell.classList.contains('onc-cell-borderless')
    || cell.classList.contains('onc-cell-borderless-lite');
}

function getCompactTableCellWidthEntry(cell) {
  if (!cell || !cell.getAttribute) return null;
  return parseInlineStyle(cell.getAttribute('style') || '').find(({ prop }) => String(prop || '').trim().toLowerCase() === 'width') || null;
}

function getCompactTableCellTextMetrics(cell) {
  if (!cellUsesCompactTableLayoutClass(cell)) return null;

  const widthEntry = getCompactTableCellWidthEntry(cell);
  if (!widthEntry || !widthEntry.value) return null;

  const widthInches = parseCssLengthToInches(widthEntry.value);
  if (!Number.isFinite(widthInches) || widthInches <= 0) return null;

  const paragraphs = Array.from(cell.querySelectorAll(':scope > p'));
  if (paragraphs.length !== 1) return null;

  const paragraph = paragraphs[0];
  if (paragraph.querySelector('img,svg,canvas,table,ul,ol,blockquote,pre,br')) return null;

  const directChildren = Array.from(paragraph.children || []);
  if (!directChildren.every((child) => /^(code|span|a)$/i.test(String(child.tagName || '')))) return null;

  const text = cleanInlineText(paragraph.textContent || '');
  if (!text || text.length > 24) return null;

  return {
    text,
    widthInches,
    density: text.length / widthInches
  };
}

function shouldPromoteCompactTableCellWidths(table) {
  if (!table || !table.querySelectorAll) return false;
  if (!(table.classList && (table.classList.contains('onc-table') || table.classList.contains('onc-table-borderless')))) return false;

  const rows = getTableRows(table);
  if (rows.length < 2 || rows.length > 8) return false;

  const firstRowCells = getRowCells(rows[0]);
  if (firstRowCells.length < 2 || firstRowCells.length > 4) return false;

  let measuredCells = 0;
  let denseCells = 0;

  for (const row of rows) {
    const cells = getRowCells(row);
    if (cells.length !== firstRowCells.length) return false;
    for (const cell of cells) {
      const metrics = getCompactTableCellTextMetrics(cell);
      if (!metrics) return false;
      measuredCells += 1;
      if (metrics.density >= 10.5) {
        denseCells += 1;
      }
    }
  }

  return measuredCells > 0 && denseCells > 0;
}

function rewriteWidthStyleToMinWidth(cell) {
  if (!cell || !cell.getAttribute) return false;
  const entries = parseInlineStyle(cell.getAttribute('style') || '');
  if (!entries.length) return false;

  let changed = false;
  const nextEntries = entries.map((entry) => {
    const prop = String(entry.prop || '').trim().toLowerCase();
    if (prop !== 'width') return entry;
    changed = true;
    return {
      prop: 'min-width',
      value: entry.value
    };
  });

  if (!changed) return false;

  const nextStyle = serializeInlineStyle(nextEntries);
  if (nextStyle) {
    cell.setAttribute('style', nextStyle);
  } else {
    cell.removeAttribute('style');
  }
  return true;
}

export function compactRepeatedTypographyClasses(doc) {
  const logs = [];
  if (!doc || typeof doc.querySelectorAll !== 'function') return logs;

  const nodes = Array.from(doc.querySelectorAll('[style]'));
  const usedPatternClassNames = new Set();
  let replacements = 0;
  let prunedUtilityClasses = 0;
  let strippedStyleDeclarations = 0;

  const firstPass = applyCompactPatterns(nodes, [...COMPACT_TYPOGRAPHY_PATTERNS, ...COMPACT_LAYOUT_PATTERNS], usedPatternClassNames);
  replacements += firstPass.replacements;
  strippedStyleDeclarations += firstPass.strippedStyleDeclarations;

  const residualNodes = nodes.filter((node) => node && node.hasAttribute && node.hasAttribute('style'));
  const secondPass = applyCompactPatterns(residualNodes, RESIDUAL_COMPACT_PATTERNS, usedPatternClassNames);
  replacements += secondPass.replacements;
  strippedStyleDeclarations += secondPass.strippedStyleDeclarations;

  nodes.forEach((node) => {
    REDUNDANT_UTILITY_PRUNE_RULES.forEach((rule) => {
      if (!hasRequiredClasses(node, [rule.className])) return;
      if (!hasRequiredStyles(node, rule.requiredStyles)) return;
      removeClassNames(node, [rule.className]);
      prunedUtilityClasses += 1;
    });
  });

  const attributeCleanup = cleanupRedundantAttributes(doc);

  if (!replacements && !prunedUtilityClasses && !attributeCleanup.emptyStyleRemoved && !attributeCleanup.emptyClassRemoved && !attributeCleanup.classAttributesDeduped) {
    return logs;
  }

  const inserted = replacements ? ensureCompactTypographyStyle(doc, Array.from(usedPatternClassNames)) : false;
  logs.push({
    step: 'CompactRepeatedTypographyClasses',
    replacements,
    prunedUtilityClasses,
    strippedStyleDeclarations,
    emptyStyleRemoved: attributeCleanup.emptyStyleRemoved,
    emptyClassRemoved: attributeCleanup.emptyClassRemoved,
    classAttributesDeduped: attributeCleanup.classAttributesDeduped,
    stylesheetInserted: inserted,
    patterns: COMPACT_TYPOGRAPHY_PATTERNS.length + COMPACT_LAYOUT_PATTERNS.length
  });
  return logs;
}

export function promoteCompactContentTableCellWidthsToMinWidth(doc) {
  const logs = [];
  if (!doc || typeof doc.querySelectorAll !== 'function') return logs;

  let tablesAdjusted = 0;
  let cellsAdjusted = 0;

  Array.from(doc.querySelectorAll('table')).forEach((table) => {
    if (!shouldPromoteCompactTableCellWidths(table)) return;

    let tableCellsAdjusted = 0;
    Array.from(table.querySelectorAll('td,th')).forEach((cell) => {
      if (rewriteWidthStyleToMinWidth(cell)) {
        tableCellsAdjusted += 1;
      }
    });

    if (!tableCellsAdjusted) return;
    tablesAdjusted += 1;
    cellsAdjusted += tableCellsAdjusted;
  });

  if (tablesAdjusted) {
    logs.push({
      step: 'PromoteCompactContentTableCellWidthsToMinWidth',
      tablesAdjusted,
      cellsAdjusted
    });
  }

  return logs;
}

function isLeadingTagParagraph(el) {
  if (!el || !el.tagName || String(el.tagName).toLowerCase() !== 'p') return false;
  const styleText = String(el.getAttribute('style') || '').trim();
  if (!styleText || /text-indent\s*:\s*calc\(/i.test(styleText)) return false;

  const textIndent = getInlineStyleValue(el, 'text-indent');
  const indentInches = parseCssLengthToInches(textIndent);
  if (!Number.isFinite(indentInches) || indentInches > -0.08 || indentInches < -0.35) return false;

  const firstElement = el.firstElementChild;
  if (!firstElement || String(firstElement.tagName || '').toLowerCase() !== 'img') return false;
  if (!isSmallInlineIconImage(firstElement)) return false;

  const trailingText = Array.from(el.childNodes || [])
    .filter((node) => node.nodeType === TEXT_NODE)
    .map((node) => String(node.textContent || ''))
    .join('');
  if (!cleanInlineText(trailingText)) return false;

  return true;
}

function isSmallInlineIconImage(img) {
  if (!img || !img.getAttribute) return false;
  const width = Number.parseFloat(String(img.getAttribute('width') || '').trim());
  const height = Number.parseFloat(String(img.getAttribute('height') || '').trim());
  if (Number.isFinite(width) && width > 20) return false;
  if (Number.isFinite(height) && height > 20) return false;
  return true;
}

export function normalizeLeadingTagParagraphIndent(doc) {
  const logs = [];
  if (!doc || typeof doc.querySelectorAll !== 'function') return logs;

  let updated = 0;
  Array.from(doc.querySelectorAll('p[style]')).forEach((el) => {
    if (!isLeadingTagParagraph(el)) return;

    const entries = parseInlineStyle(el.getAttribute('style') || '');
    const nextEntries = entries.map((entry) => {
      const prop = String(entry.prop || '').trim().toLowerCase();
      if (prop !== 'text-indent') return entry;
      return {
        prop: entry.prop,
        value: `calc(${String(entry.value || '').trim()} - 0.23em)`
      };
    });

    const nextStyle = serializeInlineStyle(nextEntries);
    if (!nextStyle || nextStyle === el.getAttribute('style')) return;
    el.setAttribute('style', nextStyle);
    updated += 1;
  });

  if (updated) {
    logs.push({ step: 'NormalizeLeadingTagParagraphIndent', updated });
  }
  return logs;
}

export function normalizeContentBlankLineSpacers(doc) {
  const logs = [];
  if (!doc || typeof doc.querySelectorAll !== 'function') return logs;
  const main = doc.querySelector('main');
  if (!main) return logs;

  const candidates = Array.from(main.querySelectorAll('p,div,blockquote'));
  let normalized = 0;

  candidates.forEach((el) => {
    if (!isWhitespaceOnlyParagraphLike(el)) return;
    const inTable = Boolean(el.closest && el.closest('table,thead,tbody,tfoot,tr,td,th'));
    if (inTable && !shouldNormalizeTableBlankLineSpacer(el)) return;
    if (el.querySelector && el.querySelector('img,svg,canvas,code,pre,ul,ol')) return;
    if (Array.from(el.classList || []).includes('converted-page-spacer')) return;

    el.textContent = '';
    if (!el.querySelector || !el.querySelector(':scope > br')) {
      el.appendChild(doc.createElement('br'));
    }
    addClass(el, 'converted-content-spacer');
    normalized += 1;
  });

  if (normalized) {
    logs.push({ step: 'NormalizeContentBlankLineSpacers', normalized });
  }
  return logs;
}

export function ensureCreatedWithOneNoteFooterGap(doc, options = {}) {
  const logs = [];
  if (!doc || typeof doc.querySelectorAll !== 'function') return logs;

  const spacerText = typeof options.spacerText === 'string' ? options.spacerText : '\u00a0';
  const footerMarginLeft = typeof options.footerMarginLeft === 'string' ? options.footerMarginLeft : '8px';
  const footers = Array.from(doc.querySelectorAll('p')).filter(el => {
    if (!el || !el.textContent) return false;
    return isCreatedWithOneNoteFooterText(el.textContent);
  });

  let inserted = 0;
  let normalized = 0;
  let alreadyPresent = 0;
  let collapsed = 0;
  let trimmedBeforeFooter = 0;
  let footerInsetNormalized = 0;

  function ensureFooterInset(footer) {
    if (!footer || !footer.getAttribute || !footerMarginLeft) return false;
    const entries = parseInlineStyle(footer.getAttribute('style') || '');
    let found = false;
    let changed = false;

    const nextEntries = entries.map((entry) => {
      const prop = String(entry.prop || '').trim().toLowerCase();
      if (prop !== 'margin-left') return entry;
      found = true;
      const current = normalizeCssToken(entry.value);
      if (current && current !== '0' && current !== '0px') {
        return entry;
      }
      changed = true;
      return {
        prop: entry.prop,
        value: footerMarginLeft
      };
    });

    if (!found) {
      nextEntries.push({ prop: 'margin-left', value: footerMarginLeft });
      changed = true;
    }

    if (!changed) return false;
    const nextStyle = serializeInlineStyle(nextEntries);
    if (nextStyle) {
      footer.setAttribute('style', nextStyle);
    } else {
      footer.removeAttribute('style');
    }
    return true;
  }

  footers.forEach((footer) => {
    if (ensureFooterInset(footer)) {
      footerInsetNormalized += 1;
    }

    const container = footer.parentElement;
    const beforeContainer = container && container.previousElementSibling;
    if (beforeContainer) {
      trimmedBeforeFooter += trimTrailingVisualSpacersDeep(beforeContainer);
    }

    const prev = footer.previousElementSibling;
    if (isVisualSpacerElement(prev)) {
      if (ensureVisibleSpacerBlock(prev, doc)) {
        normalized += 1;
      }

      // If a spacer also exists right before the footer container,
      // collapse it so we keep just one compact gap near the footer.
      const boundarySpacer = container && container.previousElementSibling;
      if (isVisualSpacerElement(boundarySpacer)) {
        boundarySpacer.remove();
        collapsed += 1;
      }

      alreadyPresent += 1;
      return;
    }

    const spacer = doc.createElement('p');
    spacer.setAttribute('style', 'margin: 0');
    if (spacerText) {
      spacer.textContent = spacerText;
    }
    ensureVisibleSpacerBlock(spacer, doc);
    footer.parentNode.insertBefore(spacer, footer);
    inserted += 1;
  });

  if (inserted || normalized || alreadyPresent || footerInsetNormalized) {
    logs.push({
      step: 'EnsureCreatedWithOneNoteFooterGap',
      inserted,
      normalized,
      alreadyPresent,
      collapsed,
      trimmedBeforeFooter,
      footerInsetNormalized
    });
  }

  return logs;
}

export function normalizeCreatedWithOneNoteFooterInset(doc, options = {}) {
  const logs = [];
  if (!doc || typeof doc.querySelectorAll !== 'function') return logs;

  const footerMarginLeft = typeof options.footerMarginLeft === 'string' ? options.footerMarginLeft : '8px';
  let updated = 0;

  Array.from(doc.querySelectorAll('p')).forEach((footer) => {
    if (!footer || !footer.textContent || !isCreatedWithOneNoteFooterText(footer.textContent)) return;

    const entries = parseInlineStyle(footer.getAttribute('style') || '');
    let found = false;
    let changed = false;

    const nextEntries = entries.map((entry) => {
      const prop = String(entry.prop || '').trim().toLowerCase();
      if (prop !== 'margin-left') return entry;
      found = true;
      const current = normalizeCssToken(entry.value);
      if (current && current !== '0' && current !== '0px') {
        return entry;
      }
      changed = true;
      return {
        prop: entry.prop,
        value: footerMarginLeft
      };
    });

    if (!found) {
      nextEntries.push({ prop: 'margin-left', value: footerMarginLeft });
      changed = true;
    }

    if (!changed) return;
    const nextStyle = serializeInlineStyle(nextEntries);
    if (nextStyle) {
      footer.setAttribute('style', nextStyle);
    } else {
      footer.removeAttribute('style');
    }
    updated += 1;
  });

  if (updated) {
    logs.push({ step: 'NormalizeCreatedWithOneNoteFooterInset', updated, footerMarginLeft });
  }

  return logs;
}

export function injectCssLink(doc, cssHref) {
  const head = doc.querySelector('head') || doc.documentElement;
  const existing = Array.from(head.querySelectorAll('link[rel="stylesheet"]')).find((link) => {
    const href = String(link.getAttribute('href') || '').trim();
    return href === String(cssHref || '').trim();
  });
  if (existing) {
    return [];
  }
  const link = doc.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', cssHref);
  head.appendChild(link);
  return [{ step: 'InjectCss', details: cssHref }];
}

// collapse repeated inline styles among siblings by promoting common
// declarations into a class on the parent.  This is intentionally
// conservative: only full-style-text duplicates occurring at least
// `minCount` times are considered.  When `removeMigratedDeclarations`
// is true, the original `style` attribute is removed from the
// affected children.
export function collapseInlineStyleDuplicates(doc, options = {}) {
  const logs = [];
  const minCount = typeof options.minCount === 'number' ? options.minCount : 3;
  const remove = options.removeMigratedDeclarations === true;

  if (!doc || typeof doc.querySelectorAll !== 'function') return logs;

  function computeClasses(styleText) {
    const classes = new Set();
    parseStyle(styleText).forEach(({ prop, value }) => {
      const className = getUtilityClassForDeclaration(prop, value);
      if (className) {
        classes.add(className);
      }
    });
    return Array.from(classes);
  }

  function canonicalizeStyleSignature(styleText) {
    const entries = parseStyle(styleText);
    if (!entries.length) return null;

    const byProp = new Map();
    entries.forEach(({ prop, value }) => {
      const normalizedProp = String(prop || '').trim().toLowerCase();
      if (!normalizedProp) return;

      let normalizedValue = String(value || '').trim().replace(/\s+/g, ' ');
      if (isUtilityMappableProperty(normalizedProp)) {
        normalizedValue = normalizedValue.toLowerCase();
      }

      // last declaration wins (CSS semantics)
      byProp.set(normalizedProp, normalizedValue);
    });

    if (!byProp.size) return null;
    return Array.from(byProp.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([prop, value]) => `${prop}:${value}`)
      .join(';');
  }

  // iterate all element parents
  const parents = Array.from(doc.querySelectorAll('*'));
  let promotions = 0;
  let childrenFixed = 0;

  parents.forEach(parent => {
    const children = Array.from(parent.children).filter(c => c.getAttribute && c.getAttribute('style'));
    if (children.length < minCount) return;

    const styleGroups = new Map();
    const styleSamples = new Map();
    children.forEach(child => {
      const originalText = (child.getAttribute('style') || '').trim();
      if (!originalText) return;
      const signature = canonicalizeStyleSignature(originalText);
      if (!signature) return;
      const arr = styleGroups.get(signature) || [];
      arr.push(child);
      styleGroups.set(signature, arr);
      if (!styleSamples.has(signature)) {
        styleSamples.set(signature, originalText);
      }
    });

    for (const [styleSignature, arr] of styleGroups) {
      if (arr.length >= minCount) {
        const sampleStyle = styleSamples.get(styleSignature) || styleSignature;
        const classes = computeClasses(sampleStyle);
        if (classes.length) {
          classes.forEach(cl => addClass(parent, cl));
          promotions++;
          if (remove) {
            arr.forEach(ch => {
              ch.removeAttribute('style');
              childrenFixed++;
            });
          }
          logs.push({
            step: 'CollapseInlineStyles',
            parent: parent.tagName.toLowerCase(),
            style: sampleStyle,
            signature: styleSignature,
            count: arr.length,
            classes
          });
        }
        break; // only one style per parent
      }
    }
  });

  if (promotions) {
    logs.push({ step: 'CollapseInlineStylesSummary', promotions, childrenFixed, minCount, remove });
  }
  return logs;
}

// Ensure the document contains a <main> landmark and a level-1 heading
// cell constants for environments without global Node (e.g. Node.js/jsdom)
const ELEMENT_NODE = typeof Node !== 'undefined' ? Node.ELEMENT_NODE : 1;
const TEXT_NODE = typeof Node !== 'undefined' ? Node.TEXT_NODE : 3;
const DOCUMENT_POSITION_PRECEDING = typeof Node !== 'undefined' ? Node.DOCUMENT_POSITION_PRECEDING : 2;

function parseNumericFontSize(styleText = '') {
  const m = String(styleText || '').match(/font-size\s*:\s*([0-9]*\.?[0-9]+)\s*(pt|px|em|rem)/i);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = String(m[2] || '').toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === 'pt') return value;
  if (unit === 'px') return value * 0.75;
  if (unit === 'em' || unit === 'rem') return value * 12;
  return null;
}

export function looksLikeOneNoteTitleCandidate(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag !== 'p' && tag !== 'div' && tag !== 'span') return false;
  const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 180) return false;
  if (/^created with onenote\.?$/i.test(text)) return false;

  const styleText = String(el.getAttribute('style') || '');
  const fontSizePt = parseNumericFontSize(styleText);
  if (fontSizePt !== null) return fontSizePt >= 16;

  const className = String(el.getAttribute('class') || '').toLowerCase();
  if (/\btext-(2xl|3xl|4xl|5xl|xl)\b/.test(className)) return true;

  return false;
}

function findOneNoteTitleElement(main) {
  if (!main || !main.querySelectorAll) return null;
  const candidates = Array.from(main.querySelectorAll('p,div,span'));
  for (const el of candidates) {
    if (!looksLikeOneNoteTitleCandidate(el)) continue;
    if (el.closest && el.closest('table,td,th')) continue;
    if (el.querySelector && el.querySelector('img,table,ul,ol')) continue;
    return el;
  }
  return null;
}

function copyAttributes(fromEl, toEl) {
  for (const attr of Array.from(fromEl.attributes || [])) {
    toEl.setAttribute(attr.name, attr.value);
  }
}

function isPlaceholderDocumentTitle(value = '') {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return normalized === '' || normalized === 'document';
}

export function ensureMainHeading(doc, options = {}) {
  const logs = [];
  const body = doc.body || doc.querySelector('body') || doc.documentElement;
  if (!body) return logs;

  let main = body.querySelector('main');
  if (!main) {
    main = doc.createElement('main');
    // move all existing body children into main
    while (body.firstChild) {
      main.appendChild(body.firstChild);
    }
    body.appendChild(main);
    logs.push({ step: 'EnsureMain', details: 'Wrapped body content in <main>' });
  }

  // ensure there's an <h1> inside main
  let h1 = main.querySelector('h1');
  const resolvedPageTitle = main.querySelector('h1.converted-page-title');
  const titleLike = resolvedPageTitle ? null : findOneNoteTitleElement(main);
  const titleLikePrecedesExistingH1 = Boolean(
    h1 &&
    titleLike &&
    h1 !== titleLike &&
    (h1.compareDocumentPosition(titleLike) & DOCUMENT_POSITION_PRECEDING)
  );
  const shouldPromoteInitialTitleLike = Boolean(titleLike && (!h1 || titleLikePrecedesExistingH1));

  if (resolvedPageTitle) {
    h1 = resolvedPageTitle;
  }

  if (shouldPromoteInitialTitleLike) {
    if (titleLike.tagName && titleLike.tagName.toLowerCase() === 'h1') {
      h1 = titleLike;
      if (!main.contains(h1)) {
        h1.remove();
        main.insertBefore(h1, main.firstChild);
      }
    }

    const existingH1LooksResolved = Boolean(
      h1 &&
      !h1.closest('table,td,th') &&
      /\bconverted-page-title\b/i.test(String(h1.getAttribute('class') || ''))
    );
    const shouldPromoteTitleLike = Boolean(
      titleLike &&
      titleLike.tagName &&
      titleLike.tagName.toLowerCase() !== 'h1' &&
      (!h1 || h1.closest('table,td,th') || !existingH1LooksResolved)
    );

    if (shouldPromoteTitleLike) {
      const promoted = doc.createElement('h1');
      copyAttributes(titleLike, promoted);
      promoted.innerHTML = titleLike.innerHTML;
      titleLike.replaceWith(promoted);
      h1 = promoted;
      logs.push({ step: 'PromoteParagraphTitle', details: 'Promoted OneNote title paragraph to <h1>' });
    }
  }

  if (!h1) {
    // try to promote first heading anywhere in body
    const firstHeading = body.querySelector('h1,h2,h3,h4,h5,h6');
    if (firstHeading) {
      // if it's not already h1, change tag
      if (firstHeading.tagName.toLowerCase() !== 'h1') {
        const promoted = doc.createElement('h1');
        promoted.textContent = firstHeading.textContent;
        firstHeading.replaceWith(promoted);
        h1 = promoted;
        logs.push({ step: 'PromoteHeading', details: `Promoted ${firstHeading.tagName} to <h1>` });
        // ensure it's inside main
        if (!main.contains(h1)) {
          main.insertBefore(h1, main.firstChild);
        }
      } else {
        // it is h1 but maybe outside main; move it
        h1 = firstHeading;
        if (!main.contains(h1)) {
          h1.remove();
          main.insertBefore(h1, main.firstChild);
          logs.push({ step: 'MoveH1', details: 'Moved existing <h1> into <main>' });
        }
      }
    } else {
      // fallback when no title-like node exists
      const newH1 = doc.createElement('h1');
      newH1.textContent = options.defaultTitle || 'Document';
      main.insertBefore(newH1, main.firstChild);
      h1 = newH1;
      logs.push({ step: 'EnsureH1', details: 'Inserted default <h1> in <main>' });
    }
  }

  // If title is still placeholder-like, sync it with the resolved <h1>
  const titleEl = (doc.head || doc.querySelector('head')) && (doc.head || doc.querySelector('head')).querySelector('title');
  const h1Text = h1 && h1.textContent ? h1.textContent.trim() : '';
  if (titleEl && h1Text && isPlaceholderDocumentTitle(titleEl.textContent)) {
    titleEl.textContent = h1Text;
    logs.push({ step: 'SyncTitleFromH1', details: 'Replaced placeholder <title> text from <h1>' });
  }

  // demote any additional <h1> elements (only the first instance should remain as level-1)
  const allH1s = Array.from(body.querySelectorAll('h1'));
  if (allH1s.length > 1) {
    for (let i = 1; i < allH1s.length; i += 1) {
      const extra = allH1s[i];
      const h2 = doc.createElement('h2');
      for (const attr of Array.from(extra.attributes || [])) {
        h2.setAttribute(attr.name, attr.value);
      }
      // preserve inner HTML/contents including styling
      h2.innerHTML = extra.innerHTML;
      extra.replaceWith(h2);
      logs.push({ step: 'DemoteExtraH1', details: 'Replaced extra <h1> with <h2>' });
    }
  }

  return logs;
}

// repair malformed lists by ensuring only <li> children and wrapping other nodes
export function ensureListStructure(doc) {
  const logs = [];
  const lists = Array.from(doc.querySelectorAll('ul,ol'));
  let fixedCount = 0;
  let unwrappedCount = 0;
  lists.forEach(list => {
    const directElementChildren = Array.from(list.children || []).filter(n => n.nodeType === ELEMENT_NODE);
    const hasDirectLi = directElementChildren.some(child => child.tagName && child.tagName.toLowerCase() === 'li');
    if (directElementChildren.length > 0 && !hasDirectLi) {
      const parent = list.parentNode;
      if (parent) {
        while (list.firstChild) {
          parent.insertBefore(list.firstChild, list);
        }
        parent.removeChild(list);
        unwrappedCount += 1;
      }
      return;
    }

    let changed = false;
    const children = Array.from(list.childNodes);
    children.forEach(node => {
      if (node.nodeType === ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        if (tag !== 'li') {
          const li = doc.createElement('li');
          li.appendChild(node.cloneNode(true));
          list.replaceChild(li, node);
          changed = true;
        }
      } else if (node.nodeType === TEXT_NODE) {
        const txt = node.textContent.trim();
        if (txt) {
          const li = doc.createElement('li');
          li.textContent = txt;
          list.replaceChild(li, node);
          changed = true;
        } else {
          list.removeChild(node);
          changed = true;
        }
      }
      // other node types (comments) can be removed
      else if (node.nodeType !== ELEMENT_NODE) {
        list.removeChild(node);
        changed = true;
      }
    });
    if (changed) {
      fixedCount++;
      logs.push({ step: 'EnsureListStructure', details: `Fixed children of <${list.tagName.toLowerCase()}>` });
    }
  });
  if (fixedCount) logs.push({ step: 'EnsureListStructureCount', fixedCount });
  if (unwrappedCount) logs.push({ step: 'UnwrapMalformedListCount', unwrappedCount });

  // remove explicit bullet glyphs from list items (e.g. • or ·) to avoid duplicates
  const bulletRegex = /^[\s\u00A0]*(?:[•·\u2022\u00B7]+|-(?=[\s\u00A0]))[\s\u00A0]*/;
  Array.from(doc.querySelectorAll('li')).forEach(li => {
    const first = li.firstChild;
    if (first && first.nodeType === TEXT_NODE) {
      const cleaned = first.textContent.replace(bulletRegex, '');
      if (cleaned !== first.textContent) {
        first.textContent = cleaned;
        logs.push({ step: 'StripBulletGlyph', details: 'Removed explicit bullet from <li>' });
      }
    }
  });

  // second pass: collapse lists that merely wrap a single nested list
  // e.g. <ul><li><ol>...</ol></li></ul>  -> <ol>...</ol>
  const updatedLists = Array.from(doc.querySelectorAll('ul,ol'));
  updatedLists.forEach(list => {
    const elChildren = Array.from(list.children).filter(n=>n.nodeType===ELEMENT_NODE);
    if (elChildren.length === 1 && elChildren[0].tagName.toLowerCase() === 'li') {
      const li = elChildren[0];
      const innerList = Array.from(li.children).find(n => n.tagName && /^(ul|ol)$/i.test(n.tagName));
      if (innerList) {
        // ensure the <li> has no other text content besides whitespace
        const clone = li.cloneNode(true);
        const childList = clone.querySelector('ul,ol');
        if (childList) clone.removeChild(childList);
        if (clone.textContent.trim() === '') {
          list.replaceWith(innerList);
          logs.push({ step: 'CollapseNestedList', details: `Collapsed <${list.tagName.toLowerCase()}> wrapping singleton <${innerList.tagName.toLowerCase()}>` });
        }
      }
    }
  });

  return logs;
}

// Remove adjacent duplicate <li> elements from any list. This is a defensive
// pass meant to catch cases where earlier repairs accidentally cloned or left
// behind the same item twice in a row. The pipeline invokes this after
// `ensureListStructure`.
export function dedupeLists(doc) {
  const logs = [];
  const lists = Array.from(doc.querySelectorAll('ul,ol'));
  lists.forEach(list => {
    let previousHtml = null;
    let removed = 0;
    Array.from(list.children).forEach(child => {
      if (child.nodeType === ELEMENT_NODE && child.tagName.toLowerCase() === 'li') {
        const html = child.outerHTML;
        if (previousHtml === html) {
          child.remove();
          removed += 1;
        } else {
          previousHtml = html;
        }
      } else {
        previousHtml = null;
      }
    });
    if (removed) logs.push({ step: 'dedupeLists', list: list.tagName.toLowerCase(), removed });
  });
  return logs;
}

