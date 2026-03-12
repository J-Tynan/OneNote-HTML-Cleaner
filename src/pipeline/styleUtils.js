export function parseStyleDeclarationEntries(styleText) {
  return String(styleText || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf(':');
      if (separator < 0) return null;
      const prop = part.slice(0, separator).trim().toLowerCase();
      const value = part.slice(separator + 1).trim();
      if (!prop) return null;
      return { prop, value };
    })
    .filter(Boolean);
}

export function serializeStyleDeclarationEntries(entries) {
  return Array.isArray(entries)
    ? entries.map(({ prop, value }) => `${prop}: ${value}`).join('; ')
    : '';
}

export function parseStyleDeclarations(styleText) {
  const declarations = {};
  const entries = parseStyleDeclarationEntries(styleText);
  entries.forEach(({ prop, value }) => {
    declarations[String(prop || '').trim().toLowerCase()] = value;
  });
  return declarations;
}

export function parseCssLength(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  const match = normalized.match(/^(-?\d*\.?\d+)\s*(px|pt|em|rem|in)?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  return {
    value: amount,
    unit: String(match[2] || 'px').toLowerCase()
  };
}

export function parseCssNumericValue(value) {
  const source = String(value || '').trim();
  if (!source) return null;
  const match = source.match(/^-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function cssLengthToPx(value) {
  const parsed = parseCssLength(value);
  if (!parsed) return null;

  if (parsed.unit === 'px') return parsed.value;
  if (parsed.unit === 'pt') return parsed.value * (96 / 72);
  if (parsed.unit === 'em' || parsed.unit === 'rem') return parsed.value * 16;
  if (parsed.unit === 'in') return parsed.value * 96;
  return null;
}