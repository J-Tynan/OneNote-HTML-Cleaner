import { baseNameFromFile, toFolderSafeName } from './sourceKind.js';

const ONE_SIGNATURE = [0xE4, 0x52, 0x5C, 0x7B, 0x8C, 0xD8, 0xA7, 0x4D, 0xAE, 0xB1, 0x53, 0x78, 0xD0, 0x29, 0x96, 0xD3];

function hasOneSignature(bytes) {
  if (!bytes || bytes.length < ONE_SIGNATURE.length) return false;
  for (let i = 0; i < ONE_SIGNATURE.length; i += 1) {
    if (bytes[i] !== ONE_SIGNATURE[i]) return false;
  }
  return true;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function extractWideStringRecords(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records = [];
  let current = '';
  let startOffset = -1;

  for (let offset = 0; offset + 1 < view.byteLength; offset += 2) {
    const code = view.getUint16(offset, true);
    const isAsciiPrintable = code >= 0x20 && code <= 0x7E;
    if (isAsciiPrintable) {
      if (startOffset < 0) {
        startOffset = offset;
      }
      current += String.fromCharCode(code);
      continue;
    }

    if (current.length >= 4) {
      const value = current.replace(/\s+/g, ' ').trim();
      if (value) {
        records.push({ value, startOffset, endOffset: offset });
      }
    }
    current = '';
    startOffset = -1;
  }

  if (current.length >= 4) {
    const value = current.replace(/\s+/g, ' ').trim();
    if (value) {
      records.push({ value, startOffset, endOffset: view.byteLength });
    }
  }

  return records;
}

function isLikelyPageTitle(value) {
  if (!value) return false;
  if (value.length < 4 || value.length > 80) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (/[^\x20-\x7E]/.test(value)) return false;
  if (/resolutionId|provider=|hash=|localId|Calibri|PageTitle|PageDateTime/i.test(value)) return false;
  if (/^[A-Za-z]+\s[A-Za-z]+$/.test(value) && !/page/i.test(value)) {
    return false;
  }
  return true;
}

function titleScore(value) {
  let score = 0;
  if (/page/i.test(value)) score += 5;
  if (/\d/.test(value)) score += 3;
  if (value.length >= 5 && value.length <= 50) score += 2;
  if (/^[A-Za-z]+\s[A-Za-z]+$/.test(value) && !/page/i.test(value)) score -= 3;
  return score;
}

function extractPageDescriptors(records) {
  const descriptors = [];
  const seenTitles = new Set();

  for (let index = 0; index < records.length; index += 1) {
    if (records[index].value !== 'PageTitle') continue;

    let bestCandidate = '';
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestCandidateIndex = -1;

    for (let probe = index - 1; probe >= Math.max(0, index - 6); probe -= 1) {
      const candidate = records[probe].value;
      if (!isLikelyPageTitle(candidate)) continue;
      const score = titleScore(candidate);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
        bestCandidateIndex = probe;
      }
    }

    if (!bestCandidate || bestScore <= 0 || seenTitles.has(bestCandidate)) {
      continue;
    }

    seenTitles.add(bestCandidate);
    descriptors.push({
      title: bestCandidate,
      markerIndex: index,
      titleIndex: bestCandidateIndex
    });
  }

  if (descriptors.length > 0) {
    return descriptors;
  }

  for (let idx = 0; idx < records.length; idx += 1) {
    const candidate = records[idx].value;
    if (!isLikelyPageTitle(candidate)) continue;
    if (!seenTitles.has(candidate)) {
      seenTitles.add(candidate);
      descriptors.push({
        title: candidate,
        markerIndex: idx,
        titleIndex: idx
      });
    }
    if (descriptors.length >= 12) break;
  }

  return descriptors;
}

function isLikelyPreviewLine(value, blockedValues = new Set()) {
  if (!value) return false;
  if (value.length < 4 || value.length > 180) return false;
  if (!/[A-Za-z0-9]/.test(value)) return false;
  if (blockedValues.has(value)) return false;
  if (/^<.*>$/.test(value)) return false;
  if (/resolutionId|provider=|hash=|localId|PageTitle|PageDateTime/i.test(value)) return false;
  if (/^Calibri(\s|$)/i.test(value)) return false;
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(value) && !/page/i.test(value)) return false;
  return true;
}

function extractPreviewLines(records, blockedValues, maxLines = 8) {
  const lines = [];
  const blocked = blockedValues || new Set();
  for (const record of records) {
    const value = record.value;
    if (!isLikelyPreviewLine(value, blocked)) continue;
    if (!lines.includes(value)) lines.push(value);
    if (lines.length >= maxLines) break;
  }
  return lines;
}

function extractPreviewLinesForPage(records, descriptor, nextDescriptor, fallbackLines, blockedValues, maxLines = 8) {
  const lines = [];
  const start = Math.max(0, descriptor.titleIndex >= 0 ? descriptor.titleIndex : descriptor.markerIndex);
  const end = nextDescriptor
    ? Math.max(start, nextDescriptor.titleIndex >= 0 ? nextDescriptor.titleIndex : nextDescriptor.markerIndex)
    : records.length;

  for (let index = start; index < end; index += 1) {
    const value = records[index].value;
    if (value === descriptor.title) continue;
    if (!isLikelyPreviewLine(value, blockedValues)) continue;
    if (!lines.includes(value)) lines.push(value);
    if (lines.length >= maxLines) break;
  }

  if (lines.length > 0) {
    return lines;
  }

  return fallbackLines.slice(0, maxLines);
}

function buildPageHtml(title, previewLines) {
  const titleEscaped = escapeHtml(title || 'Untitled Page');
  const lines = Array.isArray(previewLines) && previewLines.length > 0
    ? previewLines
    : ['No page text preview could be extracted from this native section content in the current heuristic pass.'];

  const previewList = lines
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titleEscaped}</title></head><body><main><h1>${titleEscaped}</h1><p>Converted from native OneNote section with heuristic extraction.</p><h2>Extracted text preview</h2><ul>${previewList}</ul></main></body></html>`;
}

export function importOneSection(arrayBuffer, options = {}) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error('Expected binary .one payload as ArrayBuffer');
  }

  const bytes = new Uint8Array(arrayBuffer);
  if (!hasOneSignature(bytes)) {
    throw new Error('Invalid .one signature: file does not match expected OneNote section header');
  }

  const sectionName = baseNameFromFile(options.fileName || 'Section.one');
  const sectionFolder = toFolderSafeName(sectionName);
  const extractedRecords = extractWideStringRecords(bytes);
  const pageDescriptors = extractPageDescriptors(extractedRecords);
  const blockedValues = new Set(pageDescriptors.map((item) => item.title));
  const fallbackPreviewLines = extractPreviewLines(extractedRecords, blockedValues);

  const pages = pageDescriptors.map((descriptor, index) => {
    const nextDescriptor = pageDescriptors[index + 1] || null;
    const title = descriptor.title || `Page ${index + 1}`;
    const safeTitle = toFolderSafeName(title);
    const previewLines = extractPreviewLinesForPage(extractedRecords, descriptor, nextDescriptor, fallbackPreviewLines, blockedValues);
    return {
      name: title,
      path: `${sectionFolder}/${safeTitle}.html`,
      html: buildPageHtml(title, previewLines)
    };
  });

  const hierarchyChildren = pages.map((page) => ({
    kind: 'page',
    name: page.name,
    path: page.path,
    children: []
  }));

  return {
    sourceKind: 'one',
    hierarchy: {
      kind: 'section',
      name: sectionName,
      path: `${sectionFolder}/`,
      children: hierarchyChildren
    },
    pages,
    warnings: [
      'Section file signature validated.',
      `Extracted ${pages.length} page title(s) and page-specific text previews using native metadata heuristics.`
    ]
  };
}