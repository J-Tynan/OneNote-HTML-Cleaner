const DEFAULT_MARKDOWN_FLAVOR = 'obsidian';

const SUPPORTED_FLAVORS = Object.freeze([
  'obsidian',
  'commonmark',
  'gfm',
  'markdown-extra'
]);

function normalizeLineBreaks(value) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

function normalizeTaskListMarkers(markdown) {
  return String(markdown || '').replace(/^(\s*[-*+]\s+)\[(x|X|\s)\]\s+/gm, (match, prefix, marker) => {
    const normalizedMarker = marker && marker.toLowerCase() === 'x' ? 'x' : ' ';
    return `${prefix}[${normalizedMarker}] `;
  });
}

function normalizeTableDelimiters(markdown) {
  return String(markdown || '').replace(/^\|\s*(:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)*)\s*\|\s*$/gm, (line, cells) => {
    const normalized = String(cells)
      .split('|')
      .map((cell) => cell.trim())
      .map((cell) => {
        if (/^:-{3,}:$/.test(cell)) return ':---:';
        if (/^:-{3,}$/.test(cell)) return ':---';
        if (/^-{3,}:$/.test(cell)) return '---:';
        return '---';
      })
      .join(' | ');
    return `| ${normalized} |`;
  });
}

function normalizeFencedCodeBlocks(markdown) {
  return String(markdown || '').replace(/^~~~(.*)$/gm, '```$1');
}

function applyLineBreakPolicy(markdown, flavor) {
  const normalized = normalizeLineBreaks(markdown);
  if (flavor === 'markdown-extra') {
    return normalized.replace(/\n{3,}/g, '\n\n');
  }
  return normalized;
}

function applyCommonMarkTaskPolicy(markdown) {
  return String(markdown || '').replace(/^([ \t]*[-*+]\s+)\[(x|\s)\]\s+/gm, (match, prefix, marker) => {
    return `${prefix}\\[${marker}\\] `;
  });
}

function applyGfmAutolinkPolicy(markdown) {
  return String(markdown || '').replace(/\[(https?:\/\/[^\]\s]+)\]\(\1\)/g, '<$1>');
}

export function normalizeMarkdownFlavor(flavor) {
  const normalized = String(flavor || '').trim().toLowerCase();
  if (!normalized) return DEFAULT_MARKDOWN_FLAVOR;
  if (SUPPORTED_FLAVORS.includes(normalized)) return normalized;
  return DEFAULT_MARKDOWN_FLAVOR;
}

export function getSupportedMarkdownFlavors() {
  return SUPPORTED_FLAVORS.slice();
}

export function applyMarkdownFlavor(baseMarkdown, options = {}) {
  const flavor = normalizeMarkdownFlavor(options.flavor);
  let output = String(baseMarkdown || '');

  output = normalizeFencedCodeBlocks(output);
  output = normalizeTaskListMarkers(output);
  output = normalizeTableDelimiters(output);
  output = applyLineBreakPolicy(output, flavor);

  if (flavor === 'obsidian') {
    return output;
  }

  if (flavor === 'commonmark') {
    output = applyCommonMarkTaskPolicy(output);
    return output;
  }

  if (flavor === 'gfm') {
    output = applyGfmAutolinkPolicy(output);
    return output;
  }

  if (flavor === 'markdown-extra') {
    return output;
  }

  return output;
}
