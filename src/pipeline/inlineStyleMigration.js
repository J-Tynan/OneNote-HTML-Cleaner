const FONT_FAMILY_RE = /^font-family$/i;
const FONT_SIZE_RE = /^font-size$/i;
const FONT_WEIGHT_RE = /^font-weight$/i;
const MARGIN_TOP_RE = /^margin-top$/i;
const MARGIN_BOTTOM_RE = /^margin-bottom$/i;

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
  return String(styleText || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const idx = part.indexOf(':');
      if (idx === -1) return null;
      const prop = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (!prop) return null;
      return { prop, value };
    })
    .filter(Boolean);
}

function toStyleText(entries) {
  return entries.map(({ prop, value }) => `${prop}: ${value}`).join('; ');
}

function cssToPx(value) {
  const v = String(value || '').trim().toLowerCase();
  const match = v.match(/^(-?\d*\.?\d+)\s*(px|pt|em|rem)?$/i);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  if (Number.isNaN(amount)) return null;
  const unit = (match[2] || 'px').toLowerCase();
  if (unit === 'px') return amount;
  if (unit === 'pt') return amount * (96 / 72);
  if (unit === 'em' || unit === 'rem') return amount * 16;
  return null;
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
      const normalizedProp = prop.toLowerCase();

      if (FONT_FAMILY_RE.test(normalizedProp)) {
        addClass(node, 'font-sans');
        declarationsMigrated += 1;
        changed = true;
        if (!removeMigratedDeclarations) {
          kept.push({ prop, value });
        }
        return;
      }

      if (FONT_SIZE_RE.test(normalizedProp)) {
        const className = mapFontSize(value);
        if (className) {
          addClass(node, className);
          declarationsMigrated += 1;
          changed = true;
          if (!removeMigratedDeclarations) {
            kept.push({ prop, value });
          }
          return;
        }
      }

      if (FONT_WEIGHT_RE.test(normalizedProp)) {
        const className = mapFontWeight(value);
        if (className) {
          addClass(node, className);
          declarationsMigrated += 1;
          changed = true;
          if (!removeMigratedDeclarations) {
            kept.push({ prop, value });
          }
          return;
        }
      }

      if (MARGIN_TOP_RE.test(normalizedProp)) {
        const className = mapMarginClass('mt', value);
        if (className) {
          addClass(node, className);
          declarationsMigrated += 1;
          changed = true;
          if (!removeMigratedDeclarations) {
            kept.push({ prop, value });
          }
          return;
        }
      }

      if (MARGIN_BOTTOM_RE.test(normalizedProp)) {
        const className = mapMarginClass('mb', value);
        if (className) {
          addClass(node, className);
          declarationsMigrated += 1;
          changed = true;
          if (!removeMigratedDeclarations) {
            kept.push({ prop, value });
          }
          return;
        }
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
