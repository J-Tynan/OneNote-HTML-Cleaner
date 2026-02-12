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

function extractUtf8StringRecords(bytes) {
  const records = [];
  let start = -1;
  let current = '';

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    const isPrintable = byte >= 0x20 && byte <= 0x7E;
    if (isPrintable) {
      if (start < 0) {
        start = index;
      }
      current += String.fromCharCode(byte);
      continue;
    }

    if (current.length >= 4) {
      const value = current.replace(/\s+/g, ' ').trim();
      if (value) {
        records.push({ value, startOffset: start, endOffset: index });
      }
    }
    start = -1;
    current = '';
  }

  if (current.length >= 4) {
    const value = current.replace(/\s+/g, ' ').trim();
    if (value) {
      records.push({ value, startOffset: start, endOffset: bytes.length });
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

  const allowedChars = value.match(/[A-Za-z0-9\s,.;:'"!?()\-_/]/g) || [];
  const printableRatio = allowedChars.length / value.length;
  if (printableRatio < 0.85) return false;

  const letterRatio = (value.match(/[A-Za-z]/g) || []).length / value.length;
  if (letterRatio < 0.25 && !/\d{2,}/.test(value)) return false;

  const longWordCount = (value.match(/[A-Za-z]{3,}/g) || []).length;
  if (longWordCount === 0 && !/\d{2,}/.test(value)) return false;

  if (/[^A-Za-z0-9\s]{3,}/.test(value)) return false;

  if (/^[A-Z0-9]{3,}[!?]?$/.test(value)) return false;

  const isDateOrTime = /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(value) || /\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/.test(value);
  if (!isDateOrTime) {
    const vowelCount = (value.match(/[AEIOUaeiou]/g) || []).length;
    if (vowelCount < 2) return false;
    if (!/\s/.test(value) && value.length > 16) return false;
  }

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

function extractPreviewLinesFromRange(records, startOffset, endOffset, blockedValues, maxLines = 8) {
  const lines = [];
  const min = Math.max(0, startOffset - 4096);
  const max = endOffset + 4096;

  for (const record of records) {
    if (record.endOffset < min || record.startOffset > max) continue;
    const value = record.value;
    if (!isLikelyPreviewLine(value, blockedValues)) continue;
    if (!lines.includes(value)) lines.push(value);
    if (lines.length >= maxLines) break;
  }

  return lines;
}

function mergeUniqueLines(primary, secondary, maxLines = 8) {
  const merged = [];
  for (const source of [primary || [], secondary || []]) {
    for (const line of source) {
      if (!line || merged.includes(line)) continue;
      merged.push(line);
      if (merged.length >= maxLines) return merged;
    }
  }
  return merged;
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
  const extractedUtf8Records = extractUtf8StringRecords(bytes);
  const pageDescriptors = extractPageDescriptors(extractedRecords);
  const blockedValues = new Set(pageDescriptors.map((item) => item.title));
  const fallbackPreviewLines = mergeUniqueLines(
    extractPreviewLines(extractedRecords, blockedValues),
    extractPreviewLines(extractedUtf8Records, blockedValues)
  );

  const pages = pageDescriptors.map((descriptor, index) => {
    const nextDescriptor = pageDescriptors[index + 1] || null;
    const title = descriptor.title || `Page ${index + 1}`;
    const safeTitle = toFolderSafeName(title);

    const wideLines = extractPreviewLinesForPage(extractedRecords, descriptor, nextDescriptor, fallbackPreviewLines, blockedValues);
    const currentRecord = descriptor.titleIndex >= 0 ? extractedRecords[descriptor.titleIndex] : extractedRecords[descriptor.markerIndex];
    const nextRecord = nextDescriptor
      ? (nextDescriptor.titleIndex >= 0 ? extractedRecords[nextDescriptor.titleIndex] : extractedRecords[nextDescriptor.markerIndex])
      : null;
    const rangeStart = currentRecord ? currentRecord.startOffset : 0;
    const rangeEnd = nextRecord ? nextRecord.startOffset : bytes.length;
    const utf8Lines = extractPreviewLinesFromRange(extractedUtf8Records, rangeStart, rangeEnd, blockedValues);
    const previewLines = mergeUniqueLines(wideLines, utf8Lines);

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