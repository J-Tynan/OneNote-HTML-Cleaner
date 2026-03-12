export const FONT_FAMILY_RE = /^font-family$/i;
export const FONT_SIZE_RE = /^font-size$/i;
export const FONT_WEIGHT_RE = /^font-weight$/i;
export const MARGIN_TOP_RE = /^margin-top$/i;
export const MARGIN_BOTTOM_RE = /^margin-bottom$/i;

import {
  cssLengthToPx,
  parseStyleDeclarationEntries,
  serializeStyleDeclarationEntries
} from './styleUtils.js';

const FONT_SIZE_MAP = [
  { maxPx: 12, className: 'text-xs' },
  { maxPx: 14, className: 'text-sm' },
  { maxPx: 17, className: 'text-base' },
  { maxPx: 20, className: 'text-lg' },
  { maxPx: Infinity, className: 'text-xl' }
];

const FONT_WEIGHT_MAP = [
  { max: 450, className: 'font-normal' },
  { max: 550, className: 'font-medium' },
  { max: 650, className: 'font-semibold' },
  { max: Infinity, className: 'font-bold' }
];

const SPACING_MAP = [
  { maxPx: 0, className: '0' },
  { maxPx: 4, className: '1' },
  { maxPx: 8, className: '2' },
  { maxPx: 12, className: '3' },
  { maxPx: 16, className: '4' },
  { maxPx: Infinity, className: '6' }
];

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

function parseStyle(styleText) {
  return parseStyleDeclarationEntries(styleText);
}

function toStyleText(entries) {
  return serializeStyleDeclarationEntries(entries);
}

function cssToPx(value) {
  return cssLengthToPx(value);
}

function isUtilityMappableProperty(prop) {
  const normalizedProp = String(prop || '').trim().toLowerCase();
  return (
    FONT_FAMILY_RE.test(normalizedProp)
    || FONT_SIZE_RE.test(normalizedProp)
    || FONT_WEIGHT_RE.test(normalizedProp)
    || MARGIN_TOP_RE.test(normalizedProp)
    || MARGIN_BOTTOM_RE.test(normalizedProp)
  );
}

function mapFontSize(value) {
  const px = cssToPx(value);
  if (px === null) return null;
  return FONT_SIZE_MAP.find(entry => px <= entry.maxPx)?.className || null;
}

function mapFontWeight(value) {
  const weight = String(value || '').trim().toLowerCase();
  if (weight === 'normal') return 'font-normal';
  if (weight === 'bold') return 'font-bold';
  const numeric = parseInt(weight, 10);
  if (!Number.isNaN(numeric)) {
    return FONT_WEIGHT_MAP.find(entry => numeric <= entry.max)?.className || null;
  }
  return null;
}

function mapMarginClass(prefix, value) {
  const px = cssToPx(value);
  if (px === null) return null;
  const token = SPACING_MAP.find(entry => px <= entry.maxPx)?.className;
  if (!token) return null;
  return `${prefix}-${token}`;
}

export function getUtilityClassForDeclaration(prop, value) {
  const normalizedProp = String(prop || '').trim().toLowerCase();

  if (FONT_FAMILY_RE.test(normalizedProp)) {
    return 'font-sans';
  }

  if (FONT_SIZE_RE.test(normalizedProp)) {
    return mapFontSize(value);
  }

  if (FONT_WEIGHT_RE.test(normalizedProp)) {
    return mapFontWeight(value);
  }

  if (MARGIN_TOP_RE.test(normalizedProp)) {
    return mapMarginClass('mt', value);
  }

  if (MARGIN_BOTTOM_RE.test(normalizedProp)) {
    return mapMarginClass('mb', value);
  }

  return null;
}

export function migrateInlineStylesToUtilities(doc, options = {}) {
  const logs = [];
  const selector = options.selector || '[style]';
  const removeMigratedDeclarations = options.removeMigratedDeclarations === true;
  const nodes = Array.from(doc.querySelectorAll(selector));
  let nodesTouched = 0;
  let declarationsMigrated = 0;

  nodes.forEach(node => {
    const style = node.getAttribute('style') || '';
    const declarations = parseStyle(style);
    if (!declarations.length) return;

    const kept = [];
    let changed = false;

    declarations.forEach(({ prop, value }) => {
      const className = getUtilityClassForDeclaration(prop, value);
      if (className) {
        addClass(node, className);
        declarationsMigrated += 1;
        changed = true;
        if (!removeMigratedDeclarations) {
          kept.push({ prop, value });
        }
        return;
      }

      kept.push({ prop, value });
    });

    if (!changed) return;

    const nextStyle = toStyleText(kept);
    if (nextStyle) {
      node.setAttribute('style', nextStyle);
    } else {
      node.removeAttribute('style');
    }

    nodesTouched += 1;
  });

  if (nodesTouched) {
    logs.push({
      step: 'migrateInlineStylesToUtilities',
      nodesTouched,
      declarationsMigrated,
      removeMigratedDeclarations
    });
  }

  return logs;
}

// helpers exported for unit testing
export { parseStyle, cssToPx, isUtilityMappableProperty, mapFontSize, mapFontWeight, mapMarginClass };
