// @ts-check

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

/**
 * @typedef {{ getAttribute: (name: string) => string | null, setAttribute: (name: string, value: string) => void, removeAttribute: (name: string) => void, classList?: { add: (className: string) => void } }} DomElement
 * @typedef {{ querySelectorAll: (selector: string) => ArrayLike<DomElement> }} DomDocument
 * @typedef {{ prop: string, value: string }} StyleDeclarationEntry
 * @typedef {{ maxPx: number, className: string }} FontSizeMapEntry
 * @typedef {{ max: number, className: string }} FontWeightMapEntry
 * @typedef {{ selector?: string, removeMigratedDeclarations?: boolean }} InlineStyleMigrationOptions
 * @typedef {{ step: 'migrateInlineStylesToUtilities', nodesTouched: number, declarationsMigrated: number, removeMigratedDeclarations: boolean }} InlineStyleMigrationLogEntry
 */

/** @type {readonly FontSizeMapEntry[]} */
const FONT_SIZE_MAP = [
  { maxPx: 12, className: 'text-xs' },
  { maxPx: 14, className: 'text-sm' },
  { maxPx: 17, className: 'text-base' },
  { maxPx: 20, className: 'text-lg' },
  { maxPx: Infinity, className: 'text-xl' }
];

/** @type {readonly FontWeightMapEntry[]} */
const FONT_WEIGHT_MAP = [
  { max: 450, className: 'font-normal' },
  { max: 550, className: 'font-medium' },
  { max: 650, className: 'font-semibold' },
  { max: Infinity, className: 'font-bold' }
];

/** @type {readonly FontSizeMapEntry[]} */
const SPACING_MAP = [
  { maxPx: 0, className: '0' },
  { maxPx: 4, className: '1' },
  { maxPx: 8, className: '2' },
  { maxPx: 12, className: '3' },
  { maxPx: 16, className: '4' },
  { maxPx: Infinity, className: '6' }
];

/**
 * @param {DomElement | null | undefined} el
 * @param {string | null | undefined} className
 * @returns {void}
 */
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

/**
 * @param {unknown} styleText
 * @returns {StyleDeclarationEntry[]}
 */
function parseStyle(styleText) {
  return parseStyleDeclarationEntries(styleText);
}

/**
 * @param {StyleDeclarationEntry[]} entries
 * @returns {string}
 */
function toStyleText(entries) {
  return serializeStyleDeclarationEntries(entries);
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function cssToPx(value) {
  return cssLengthToPx(value);
}

/**
 * @param {unknown} prop
 * @returns {boolean}
 */
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

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function mapFontSize(value) {
  const px = cssToPx(value);
  if (px === null) return null;
  return FONT_SIZE_MAP.find(entry => px <= entry.maxPx)?.className || null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
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

/**
 * @param {string} prefix
 * @param {unknown} value
 * @returns {string | null}
 */
function mapMarginClass(prefix, value) {
  const px = cssToPx(value);
  if (px === null) return null;
  const token = SPACING_MAP.find(entry => px <= entry.maxPx)?.className;
  if (!token) return null;
  return `${prefix}-${token}`;
}

/**
 * @param {unknown} prop
 * @param {unknown} value
 * @returns {string | null}
 */
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

/**
 * @param {DomDocument} doc
 * @param {InlineStyleMigrationOptions} [options]
 * @returns {InlineStyleMigrationLogEntry[]}
 */
export function migrateInlineStylesToUtilities(doc, options = {}) {
  const logs = /** @type {InlineStyleMigrationLogEntry[]} */ ([]);
  const selector = options.selector || '[style]';
  const removeMigratedDeclarations = options.removeMigratedDeclarations === true;
  const nodes = Array.from(doc.querySelectorAll(selector));
  let nodesTouched = 0;
  let declarationsMigrated = 0;

  nodes.forEach(node => {
    const style = node.getAttribute('style') || '';
    const declarations = parseStyle(style);
    if (!declarations.length) return;

    const kept = /** @type {StyleDeclarationEntry[]} */ ([]);
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
