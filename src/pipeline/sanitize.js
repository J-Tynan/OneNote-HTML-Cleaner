// src/pipeline/sanitize.js
// Lightweight sanitization and head cleanup inspired by the PowerShell script.

// reuse helpers for inline-style analysis
import {
  parseStyle,
  mapFontSize,
  mapFontWeight,
  mapMarginClass,
  FONT_FAMILY_RE,
  FONT_SIZE_RE,
  FONT_WEIGHT_RE,
  MARGIN_TOP_RE,
  MARGIN_BOTTOM_RE
} from './inlineStyleMigration.js';

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

function parseInlineStyle(styleText) {
  return String(styleText || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const idx = part.indexOf(':');
      if (idx === -1) return null;
      const prop = part.slice(0, idx).trim().toLowerCase();
      const value = part.slice(idx + 1).trim();
      if (!prop) return null;
      return { prop, value };
    })
    .filter(Boolean);
}

function serializeInlineStyle(entries) {
  return entries.map(({ prop, value }) => `${prop}: ${value}`).join('; ');
}

function dedupeInlineStyle(styleText) {
  const byProp = new Map();
  parseInlineStyle(styleText).forEach(({ prop, value }) => {
    byProp.set(prop, value);
  });
  return serializeInlineStyle(Array.from(byProp.entries()).map(([prop, value]) => ({ prop, value })));
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

export function externalizeCss(doc, options = {}) {
  const logs = [];
  if (!doc || options.externalizeCssEnabled !== true) {
    return { logs, cssText: '' };
  }

  const extractedBlocks = [];
  let extractedStyleTags = 0;
  Array.from(doc.querySelectorAll('style')).forEach(styleEl => {
    const css = String(styleEl.textContent || '').trim();
    if (css) {
      extractedBlocks.push(css);
    }
    styleEl.remove();
    extractedStyleTags += 1;
  });

  const classBySignature = new Map();
  const declarationsByClass = new Map();
  let externalizedInlineStyles = 0;

  Array.from(doc.querySelectorAll('[style]')).forEach(el => {
    const original = String(el.getAttribute('style') || '').trim();
    if (!original) {
      el.removeAttribute('style');
      return;
    }

    const normalized = dedupeInlineStyle(original);
    const signature = canonicalizeInlineStyle(normalized);
    if (!signature) {
      el.removeAttribute('style');
      return;
    }

    let className = classBySignature.get(signature);
    if (!className) {
      className = `extcss-${hashStyleSignature(signature)}`;
      let suffix = 2;
      while (declarationsByClass.has(className) && declarationsByClass.get(className) !== normalized) {
        className = `extcss-${hashStyleSignature(signature)}-${suffix}`;
        suffix += 1;
      }
      classBySignature.set(signature, className);
      declarationsByClass.set(className, normalized);
    }

    addClass(el, className);
    el.removeAttribute('style');
    externalizedInlineStyles += 1;
  });

  const classRules = Array.from(declarationsByClass.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([className, declaration]) => `.${className} { ${declaration}; }`);

  const cssText = [...classRules, ...extractedBlocks].join('\n\n').trim();
  if (externalizedInlineStyles || extractedStyleTags) {
    logs.push({
      step: 'ExternalizeCss',
      externalizedInlineStyles,
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
      if (/^mso-/i.test(val) || OFFICE_NS_RE.test(val)) {
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
    if (removed.length) logs.push({ step: 'NormalizeTableAttr', tag: 'TABLE', removed });
  });
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

export function ensureImageAlt(doc, options = {}) {
  const logs = [];
  const imgs = Array.from(doc.querySelectorAll('img'));
  const fallbackAlt = typeof options.fallbackAlt === 'string' && options.fallbackAlt.trim()
    ? options.fallbackAlt.trim()
    : 'Image';

  let updated = 0;
  let decorativeSkipped = 0;

  imgs.forEach(img => {
    const role = String(img.getAttribute('role') || '').trim().toLowerCase();
    const ariaHidden = String(img.getAttribute('aria-hidden') || '').trim().toLowerCase();
    const isDecorative = role === 'presentation' || role === 'none' || ariaHidden === 'true';
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
      node.nodeValue = value.replace(/\u00a0/g, ' ');
      updated++;
    }
    node = walker.nextNode();
  }

  if (updated) logs.push({ step: 'RemoveNbsp', updated });
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

  // utility to compute classes from a style string (reuses parsing logic)
  function computeClasses(styleText) {
    const classes = [];
    const entries = parseStyle(styleText);
    entries.forEach(({ prop, value }) => {
      const normalized = prop.toLowerCase();
      if (FONT_FAMILY_RE.test(normalized)) {
        classes.push('font-sans');
        return;
      }
      if (FONT_SIZE_RE.test(normalized)) {
        const cls = mapFontSize(value);
        if (cls) classes.push(cls);
        return;
      }
      if (FONT_WEIGHT_RE.test(normalized)) {
        const cls = mapFontWeight(value);
        if (cls) classes.push(cls);
        return;
      }
      if (MARGIN_TOP_RE.test(normalized)) {
        const cls = mapMarginClass('mt', value);
        if (cls) classes.push(cls);
        return;
      }
      if (MARGIN_BOTTOM_RE.test(normalized)) {
        const cls = mapMarginClass('mb', value);
        if (cls) classes.push(cls);
        return;
      }
    });
    return classes.filter(Boolean);
  }

  function canonicalizeStyleSignature(styleText) {
    const entries = parseStyle(styleText);
    if (!entries.length) return null;

    const byProp = new Map();
    entries.forEach(({ prop, value }) => {
      const normalizedProp = String(prop || '').trim().toLowerCase();
      if (!normalizedProp) return;

      let normalizedValue = String(value || '').trim().replace(/\s+/g, ' ');
      if (
        FONT_FAMILY_RE.test(normalizedProp) ||
        FONT_SIZE_RE.test(normalizedProp) ||
        FONT_WEIGHT_RE.test(normalizedProp) ||
        MARGIN_TOP_RE.test(normalizedProp) ||
        MARGIN_BOTTOM_RE.test(normalizedProp)
      ) {
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
      // no headings at all; create one from defaultTitle
      const newH1 = doc.createElement('h1');
      newH1.textContent = options.defaultTitle || 'Document';
      main.insertBefore(newH1, main.firstChild);
      logs.push({ step: 'EnsureH1', details: 'Inserted default <h1> in <main>' });
    }
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
  lists.forEach(list => {
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

  // remove explicit bullet glyphs from list items (e.g. • or ·) to avoid duplicates
  const bulletRegex = /^[\s\u00A0]*[•·\u2022\u00B7\-]+[\s\u00A0]*/;
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

// Remove adjacent or identical duplicate <li> elements from any list. This is a
// defensive pass meant to catch cases where earlier repairs accidentally
// cloned or left behind items. It is idempotent and cheap for typical
// documents. The pipeline invokes this after `ensureListStructure`.
export function dedupeLists(doc) {
  const logs = [];
  const lists = Array.from(doc.querySelectorAll('ul,ol'));
  lists.forEach(list => {
    const seen = new Set();
    let removed = 0;
    Array.from(list.children).forEach(child => {
      if (child.nodeType === ELEMENT_NODE && child.tagName.toLowerCase() === 'li') {
        const html = child.outerHTML;
        if (seen.has(html)) {
          child.remove();
          removed += 1;
        } else {
          seen.add(html);
        }
      }
    });
    if (removed) logs.push({ step: 'dedupeLists', list: list.tagName.toLowerCase(), removed });
  });
  return logs;
}

