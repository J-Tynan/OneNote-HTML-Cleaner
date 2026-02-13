import { baseNameFromFile, toFolderSafeName } from './sourceKind.js';
import { WARNING_CODES, makeWarning, toWarningMessages } from './warnings.js';

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
  const min = Math.max(0, startOffset);
  const max = Math.max(min, endOffset);

  for (const record of records) {
    if (record.endOffset < min || record.startOffset > max) continue;
    const value = record.value;
    if (!isLikelyPreviewLine(value, blockedValues)) continue;
    if (!lines.includes(value)) lines.push(value);
    if (lines.length >= maxLines) break;
  }

  return lines;
}

function looksBinaryLikeToken(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/\b(?:IDAT|IHDR|JFIF|Exif|PK\x03\x04|%PDF|obj|endobj)\b/i.test(text)) return true;
  if (/^[A-Za-z0-9+\/=_-]{10,}$/.test(text) && !/\s/.test(text)) return true;
  if (/[^A-Za-z0-9\s,.;:'"!?()\-_/]{2,}/.test(text)) return true;
  return false;
}

function semanticLineScore(value = '') {
  const line = String(value || '').trim();
  if (!line) return Number.NEGATIVE_INFINITY;

  if (toHeadingLevel(line)) return 4;
  if (splitTableCells(line)) return 4;
  if (/^(?:[-*•]|\d+[\.)]|[A-Za-z][\.)])\s+/.test(line)) return 4;

  let score = 0;
  if (/\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(line)) score += 1;
  if (/\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/.test(line)) score += 1;
  if (/\s/.test(line)) score += 1;
  if ((line.match(/[A-Za-z]{3,}/g) || []).length >= 2) score += 2;
  if (/^[A-Z0-9]{3,}[!?]?$/.test(line)) score -= 2;
  if (looksBinaryLikeToken(line)) score -= 3;
  return score;
}

function filterSemanticLines(lines = [], maxLines = 24) {
  const filtered = [];
  for (const candidate of lines) {
    const line = String(candidate || '').trim();
    if (!line || filtered.includes(line)) continue;

    const score = semanticLineScore(line);
    if (score < 1) continue;

    filtered.push(line);
    if (filtered.length >= maxLines) break;
  }
  return filtered;
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

function buildPageSegments(pageDescriptors, wideRecords, byteLength) {
  if (!Array.isArray(pageDescriptors) || pageDescriptors.length === 0) {
    return [{
      title: 'Page 1',
      startOffset: 0,
      endOffset: byteLength,
      source: 'fallback'
    }];
  }

  return pageDescriptors.map((descriptor, index) => {
    const nextDescriptor = pageDescriptors[index + 1] || null;
    const currentRecord = descriptor.titleIndex >= 0
      ? wideRecords[descriptor.titleIndex]
      : wideRecords[descriptor.markerIndex];
    const nextRecord = nextDescriptor
      ? (nextDescriptor.titleIndex >= 0 ? wideRecords[nextDescriptor.titleIndex] : wideRecords[nextDescriptor.markerIndex])
      : null;

    const previousDescriptor = index > 0 ? pageDescriptors[index - 1] : null;
    const previousRecord = previousDescriptor
      ? (previousDescriptor.titleIndex >= 0 ? wideRecords[previousDescriptor.titleIndex] : wideRecords[previousDescriptor.markerIndex])
      : null;

    const rawStart = currentRecord ? currentRecord.startOffset : 0;
    const rawEnd = nextRecord ? nextRecord.startOffset : byteLength;
    const previousStart = previousRecord ? previousRecord.startOffset : 0;
    const boundedStart = Math.max(previousStart, rawStart - 512);
    const boundedEnd = Math.min(byteLength, Math.max(boundedStart + 1, rawEnd + 256));

    return {
      title: descriptor.title || `Page ${index + 1}`,
      startOffset: boundedStart,
      endOffset: boundedEnd,
      source: 'descriptor'
    };
  });
}

function collectSegmentSemanticLines(wideRecords, utf8Records, segment, blockedValues, maxLines = 24) {
  const wideLines = extractPreviewLinesFromRange(
    wideRecords,
    segment.startOffset,
    segment.endOffset,
    blockedValues,
    Math.max(maxLines * 2, 32)
  );

  const utf8Lines = extractPreviewLinesFromRange(
    utf8Records,
    segment.startOffset,
    segment.endOffset,
    blockedValues,
    Math.max(maxLines * 2, 32)
  );

  const merged = mergeUniqueLines(wideLines, utf8Lines, Math.max(maxLines * 2, 32));
  return filterSemanticLines(merged, maxLines);
}

function buildSemanticPageModels(wideRecords, utf8Records, pageDescriptors, blockedValues, byteLength) {
  const fallbackPoolRaw = mergeUniqueLines(
    extractPreviewLines(wideRecords, blockedValues, 32),
    extractPreviewLines(utf8Records, blockedValues, 32),
    32
  );
  const fallbackPool = filterSemanticLines(fallbackPoolRaw, 24);

  const segments = buildPageSegments(pageDescriptors, wideRecords, byteLength);
  const models = segments.map((segment, index) => {
    const scopedLines = collectSegmentSemanticLines(wideRecords, utf8Records, segment, blockedValues, 24);
    const fallbackLines = fallbackPool.slice(0, 24);
    const lines = scopedLines.length > 0 ? scopedLines : fallbackLines;
    const blocks = buildStructuredBlocks(lines);
    const metadata = extractPageMetadata(lines, segment.title || `Page ${index + 1}`);

    return {
      title: segment.title || `Page ${index + 1}`,
      source: segment.source,
      lines,
      blocks,
      metadata: metadata.canonical,
      metadataSources: metadata.sources,
      metadataItems: metadata.items,
      metadataConflicts: metadata.conflicts,
      fallbackUsed: scopedLines.length === 0
    };
  });

  const fallbackPageCount = models.filter((item) => item.fallbackUsed).length;
  return {
    models,
    fallbackPageCount,
    fallbackPoolSize: fallbackPool.length,
    filteredOutCount: Math.max(0, fallbackPoolRaw.length - fallbackPool.length)
  };
}

function isMarkdownSeparatorRow(cells) {
  if (!Array.isArray(cells) || cells.length < 2) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(String(cell || '').trim()));
}

function splitByMultiSpace(value) {
  if (!/\s{2,}/.test(value)) return null;

  const cells = value
    .split(/\s{2,}/)
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);

  if (cells.length < 2) return null;
  const contentful = cells.filter((cell) => /[A-Za-z0-9]/.test(cell)).length;
  if (contentful < 2) return null;
  return cells;
}

function splitTableCells(line) {
  const value = String(line || '').trim();
  if (!value) return null;

  if (value.includes('\t')) {
    const cells = value
      .split('\t')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    if (cells.length >= 2) {
      return {
        cells,
        delimiter: 'tab',
        separator: isMarkdownSeparatorRow(cells)
      };
    }
  }

  if (value.includes('|')) {
    const rawCells = value.split('|').map((cell) => cell.trim());
    const leadingOrTrailingPipe = value.startsWith('|') || value.endsWith('|');
    const cells = rawCells.filter((cell) => cell.length > 0);
    if (cells.length >= 2 && (leadingOrTrailingPipe || rawCells.length >= 3)) {
      return {
        cells,
        delimiter: 'pipe',
        separator: isMarkdownSeparatorRow(cells)
      };
    }
  }

  const spacedCells = splitByMultiSpace(value);
  if (spacedCells) {
    return {
      cells: spacedCells,
      delimiter: 'space',
      separator: isMarkdownSeparatorRow(spacedCells)
    };
  }

  return null;
}

function toHeadingLevel(line) {
  const hashHeading = String(line || '').match(/^(#{1,3})\s+(.+)$/);
  if (hashHeading) {
    return {
      level: hashHeading[1].length,
      text: hashHeading[2].trim()
    };
  }

  const shortLabel = String(line || '').match(/^([A-Z][A-Za-z0-9\s]{2,60}):$/);
  if (shortLabel) {
    return {
      level: 2,
      text: shortLabel[1].trim()
    };
  }

  return null;
}

function isParagraphJoinCandidate(previousLine, nextLine) {
  const prev = String(previousLine || '').trim();
  const next = String(nextLine || '').trim();
  if (!prev || !next) return false;
  if (toHeadingLevel(next)) return false;
  if (splitTableCells(next)) return false;
  if (/^(?:[-*•]|\d+[\.)]|[A-Za-z][\.)])\s+/.test(next)) return false;

  const prevEndsSentence = /[.!?;:]$/.test(prev);
  const nextLooksNewSentence = /^[A-Z][A-Za-z0-9]/.test(next);

  if (!prevEndsSentence) return true;
  if (!nextLooksNewSentence) return true;
  return false;
}

function buildStructuredBlocks(lines) {
  const blocks = [];
  let listState = null;
  let tableState = null;
  let paragraphState = null;

  const flushList = () => {
    if (listState && listState.items.length > 0) {
      blocks.push({ kind: listState.kind, items: listState.items.slice() });
    }
    listState = null;
  };

  const flushTable = () => {
    if (tableState && tableState.rows.length > 0) {
      const maxColumns = tableState.rows.reduce((max, row) => Math.max(max, row.length), 0);
      const normalizedRows = tableState.rows.map((row) => {
        if (row.length === maxColumns) return row.slice();
        return [...row, ...new Array(maxColumns - row.length).fill('')];
      });

      blocks.push({
        kind: 'table',
        rows: normalizedRows,
        hasExplicitHeader: tableState.hasExplicitHeader,
        delimiter: tableState.delimiter
      });
    }
    tableState = null;
  };

  const flushParagraph = () => {
    if (paragraphState && paragraphState.text) {
      blocks.push({ kind: 'paragraph', text: paragraphState.text });
    }
    paragraphState = null;
  };

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line) {
      flushList();
      flushTable();
      flushParagraph();
      continue;
    }

    const tableInfo = splitTableCells(line);
    if (tableInfo) {
      flushList();
      flushParagraph();

      if (!tableState) {
        if (tableInfo.separator) {
          continue;
        }

        tableState = {
          rows: [tableInfo.cells],
          delimiter: tableInfo.delimiter,
          hasExplicitHeader: false
        };
        continue;
      }

      if (tableInfo.separator && tableState.rows.length === 1 && tableInfo.cells.length === tableState.rows[0].length) {
        tableState.hasExplicitHeader = true;
        continue;
      }

      const sameDelimiter = tableState.delimiter === tableInfo.delimiter;
      const similarWidth = Math.abs(tableState.rows[0].length - tableInfo.cells.length) <= 1;
      const compatibleDelimiter = sameDelimiter || tableState.rows.length >= 2;

      if (!compatibleDelimiter || !similarWidth) {
        flushTable();
        if (tableInfo.separator) {
          continue;
        }
        tableState = {
          rows: [tableInfo.cells],
          delimiter: tableInfo.delimiter,
          hasExplicitHeader: false
        };
        continue;
      }

      tableState.rows.push(tableInfo.cells);
      continue;
    }

    flushTable();

    const unorderedMatch = line.match(/^(?:[-*•])\s+(.+)$/);
    if (unorderedMatch) {
      if (!listState || listState.kind !== 'ul') {
        flushList();
        listState = { kind: 'ul', items: [] };
      }
      listState.items.push(unorderedMatch[1].trim());
      continue;
    }

    const orderedMatch = line.match(/^(?:\d+[\.)]|[A-Za-z][\.)])\s+(.+)$/);
    if (orderedMatch) {
      if (!listState || listState.kind !== 'ol') {
        flushList();
        listState = { kind: 'ol', items: [] };
      }
      listState.items.push(orderedMatch[1].trim());
      continue;
    }

    flushList();
    flushTable();

    const heading = toHeadingLevel(line);
    if (heading && heading.text.length > 0) {
      flushParagraph();
      blocks.push({ kind: 'heading', level: heading.level, text: heading.text });
    } else {
      if (paragraphState && isParagraphJoinCandidate(paragraphState.text, line)) {
        paragraphState.text = `${paragraphState.text} ${line}`;
      } else {
        flushParagraph();
        paragraphState = { text: line };
      }
    }
  }

  flushList();
  flushTable();
  flushParagraph();

  return blocks;
}

function renderStructuredBlocks(blocks) {
  const rendered = [];
  for (const block of blocks) {
    if (!block) continue;

    if (block.kind === 'heading') {
      const level = Math.min(3, Math.max(2, Number(block.level) || 2));
      rendered.push(`<h${level}>${escapeHtml(block.text || '')}</h${level}>`);
      continue;
    }

    if (block.kind === 'paragraph') {
      rendered.push(`<p>${escapeHtml(block.text || '')}</p>`);
      continue;
    }

    if (block.kind === 'ul' || block.kind === 'ol') {
      const items = Array.isArray(block.items) ? block.items : [];
      const itemHtml = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      rendered.push(`<${block.kind}>${itemHtml}</${block.kind}>`);
      continue;
    }

    if (block.kind === 'table') {
      const rows = Array.isArray(block.rows) ? block.rows : [];
      if (rows.length === 0) continue;

      const firstRow = rows[0] || [];
      const hasHeader = Boolean(block.hasExplicitHeader)
        || (rows.length > 1 && firstRow.some((cell) => /[A-Za-z]/.test(String(cell || ''))));

      const headerHtml = hasHeader
        ? `<thead><tr>${firstRow.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>`
        : '';

      const bodyRows = hasHeader ? rows.slice(1) : rows;
      const bodyHtml = bodyRows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('');

      rendered.push(`<table>${headerHtml}<tbody>${bodyHtml}</tbody></table>`);
    }
  }

  return rendered.join('');
}

function extractDetectedMetadata(lines) {
  return extractPageMetadata(lines).items;
}

function normalizeMetadataLabel(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function toCanonicalMetadataKey(label) {
  const value = normalizeMetadataLabel(label);
  if (!value) return null;

  const aliasMap = {
    title: 'title',
    'page title': 'title',
    'section title': 'title',
    author: 'author',
    owner: 'author',
    'created by': 'author',
    'last edited by': 'author',
    'last modified by': 'author',
    created: 'createdAt',
    'created at': 'createdAt',
    'created on': 'createdAt',
    'creation time': 'createdAt',
    'date created': 'createdAt',
    modified: 'modifiedAt',
    updated: 'modifiedAt',
    'updated at': 'modifiedAt',
    'updated on': 'modifiedAt',
    'last modified': 'modifiedAt',
    'modified at': 'modifiedAt',
    'modified on': 'modifiedAt',
    'last saved': 'modifiedAt',
    'date modified': 'modifiedAt'
  };

  if (aliasMap[value]) {
    return aliasMap[value];
  }

  if (value.startsWith('created ')) return 'createdAt';
  if (value.startsWith('modified ') || value.startsWith('updated ')) return 'modifiedAt';
  return null;
}

function normalizeMetadataDate(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return '';

  const likelyLocaleOnly = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(value) && !/(z|utc|gmt|[+\-]\d{2}:?\d{2})$/i.test(value);
  if (likelyLocaleOnly) {
    return value;
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return value;
}

function metadataPriorityFor(key, source) {
  if (key === 'title') {
    if (source === 'line-key-value') return 3;
    if (source === 'hint') return 1;
    return 2;
  }

  if (key === 'author') {
    if (source === 'line-key-value') return 3;
    return 1;
  }

  if (key === 'createdAt' || key === 'modifiedAt') {
    if (source === 'line-key-value') return 3;
    if (source === 'line-heuristic') return 2;
    return 1;
  }

  return 0;
}

function setCanonicalMetadataValue(canonical, metadataSources, conflicts, key, value, source = 'line-heuristic') {
  const normalizedValue = String(value || '').trim();
  if (!key || !normalizedValue) return;

  const finalValue = (key === 'createdAt' || key === 'modifiedAt')
    ? normalizeMetadataDate(normalizedValue)
    : normalizedValue;

  const incomingPriority = metadataPriorityFor(key, source);
  const existingPriority = metadataPriorityFor(key, metadataSources[key] || 'unknown');

  if (!canonical[key]) {
    canonical[key] = finalValue;
    metadataSources[key] = source;
    return;
  }

  if (canonical[key] !== finalValue && incomingPriority > existingPriority) {
    conflicts.push({ key, existing: canonical[key], incoming: finalValue, existingSource: metadataSources[key], incomingSource: source, resolution: 'replaced-by-priority' });
    canonical[key] = finalValue;
    metadataSources[key] = source;
    return;
  }

  if (canonical[key] !== finalValue) {
    conflicts.push({ key, existing: canonical[key], incoming: finalValue, existingSource: metadataSources[key], incomingSource: source, resolution: 'kept-existing' });
  }
}

function extractPageMetadata(lines, titleHint) {
  const items = [];
  const seen = new Set();
  const dateRegex = /\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/;
  const timeRegex = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;
  const canonical = {
    title: String(titleHint || '').trim() || undefined,
    author: undefined,
    createdAt: undefined,
    modifiedAt: undefined
  };
  const metadataSources = {
    title: canonical.title ? 'hint' : undefined,
    author: undefined,
    createdAt: undefined,
    modifiedAt: undefined
  };
  const conflicts = [];

  for (const line of lines) {
    const lineText = String(line || '').trim();
    if (!lineText) continue;

    const keyValueMatch = lineText.match(/^([^:\-]{2,40})\s*[:\-]\s*(.+)$/);
    if (keyValueMatch) {
      const [, rawLabel, rawValue] = keyValueMatch;
      const canonicalKey = toCanonicalMetadataKey(rawLabel);
      if (canonicalKey) {
        setCanonicalMetadataValue(canonical, metadataSources, conflicts, canonicalKey, rawValue, 'line-key-value');
      }
    }

    if (!canonical.createdAt && dateRegex.test(lineText) && timeRegex.test(lineText)) {
      setCanonicalMetadataValue(canonical, metadataSources, conflicts, 'createdAt', lineText, 'line-heuristic');
    }

    if (!canonical.modifiedAt && /modified|updated/i.test(lineText) && dateRegex.test(lineText)) {
      setCanonicalMetadataValue(canonical, metadataSources, conflicts, 'modifiedAt', lineText, 'line-heuristic');
    }

    if (dateRegex.test(line) && !seen.has(`date:${line}`)) {
      items.push({ label: 'Detected date', value: line });
      seen.add(`date:${line}`);
    }
    if (timeRegex.test(line) && !seen.has(`time:${line}`)) {
      items.push({ label: 'Detected time', value: line });
      seen.add(`time:${line}`);
    }
    if (items.length >= 6) break;
  }

  if (canonical.author && !seen.has(`author:${canonical.author}`)) {
    items.unshift({ label: 'Author', value: canonical.author });
    seen.add(`author:${canonical.author}`);
  }

  if (canonical.modifiedAt && !seen.has(`modified:${canonical.modifiedAt}`)) {
    items.unshift({ label: 'Modified', value: canonical.modifiedAt });
    seen.add(`modified:${canonical.modifiedAt}`);
  }

  if (canonical.createdAt && !seen.has(`created:${canonical.createdAt}`)) {
    items.unshift({ label: 'Created', value: canonical.createdAt });
    seen.add(`created:${canonical.createdAt}`);
  }

  if (canonical.title && !seen.has(`title:${canonical.title}`)) {
    items.unshift({ label: 'Title', value: canonical.title });
    seen.add(`title:${canonical.title}`);
  }

  return {
    canonical,
    sources: metadataSources,
    items: items.slice(0, 8),
    conflicts
  };
}

function uint8ArrayToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  throw new Error('No base64 encoder available in current runtime');
}

function findPngEnd(bytes, start) {
  const trailer = [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];
  for (let i = start + 8; i <= bytes.length - trailer.length; i += 1) {
    let match = true;
    for (let j = 0; j < trailer.length; j += 1) {
      if (bytes[i + j] !== trailer[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i + trailer.length;
    }
  }
  return -1;
}

function findJpegEnd(bytes, start) {
  for (let i = start + 2; i < bytes.length - 1; i += 1) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD9) {
      return i + 2;
    }
  }
  return -1;
}

function findGifEnd(bytes, start) {
  for (let i = start + 6; i < bytes.length; i += 1) {
    if (bytes[i] === 0x3B) {
      return i + 1;
    }
  }
  return -1;
}

function findPdfEnd(bytes, start) {
  const marker = [0x25, 0x25, 0x45, 0x4F, 0x46]; // %%EOF
  for (let i = start + 8; i <= bytes.length - marker.length; i += 1) {
    let match = true;
    for (let j = 0; j < marker.length; j += 1) {
      if (bytes[i + j] !== marker[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return Math.min(bytes.length, i + marker.length + 2);
    }
  }
  return -1;
}

function findZipEnd(bytes, start) {
  for (let i = start + 4; i <= bytes.length - 22; i += 1) {
    const isEocd =
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4B &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06;

    if (!isEocd) continue;
    const commentLength = bytes[i + 20] | (bytes[i + 21] << 8);
    const end = i + 22 + commentLength;
    if (end <= bytes.length) {
      return end;
    }
  }
  return -1;
}

function extractObjectPlaceholderHints(records = []) {
  const hints = [];
  const seen = new Set();
  const fileNameRegex = /\b[^<>:"/\\|?*\s]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|txt|csv|rtf)\b/i;

  for (const record of records) {
    const value = String(record && record.value ? record.value : '').trim();
    if (!value) continue;

    const hasPlaceholderSignal = /(attachment|embedded file|embedded object|object|ole|package|icon)/i.test(value);
    const fileNameMatch = value.match(fileNameRegex);

    if (!hasPlaceholderSignal && !fileNameMatch) continue;

    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    hints.push(normalized);
    if (hints.length >= 10) break;
  }

  return hints;
}

function extractEmbeddedResources(bytes, options = {}) {
  const maxResources = typeof options.maxResources === 'number' ? options.maxResources : 12;
  const maxBytesPerResource = typeof options.maxBytesPerResource === 'number' ? options.maxBytesPerResource : 600000;
  const resources = [];
  const seenRanges = new Set();

  const addResource = (kind, extension, mimeType, start, end) => {
    if (resources.length >= maxResources) return;
    if (start < 0 || end <= start || end > bytes.length) return;

    const length = end - start;
    if (length < 64 || length > maxBytesPerResource) return;

    const rangeKey = `${start}:${end}`;
    if (seenRanges.has(rangeKey)) return;
    seenRanges.add(rangeKey);

    const blob = bytes.slice(start, end);
    const index = resources.length + 1;
    const fileName = `${kind}-${String(index).padStart(2, '0')}.${extension}`;

    resources.push({
      kind,
      extension,
      fileName,
      mimeType,
      size: length,
      bytes: blob,
      dataUri: mimeType.startsWith('image/') ? `data:${mimeType};base64,${uint8ArrayToBase64(blob)}` : null
    });
  };

  for (let index = 0; index < bytes.length && resources.length < maxResources; index += 1) {
    if (
      bytes[index] === 0x89 &&
      bytes[index + 1] === 0x50 &&
      bytes[index + 2] === 0x4E &&
      bytes[index + 3] === 0x47 &&
      bytes[index + 4] === 0x0D &&
      bytes[index + 5] === 0x0A &&
      bytes[index + 6] === 0x1A &&
      bytes[index + 7] === 0x0A
    ) {
      const end = findPngEnd(bytes, index);
      if (end > 0) {
        addResource('image', 'png', 'image/png', index, end);
        index = end - 1;
      }
      continue;
    }

    if (bytes[index] === 0xFF && bytes[index + 1] === 0xD8) {
      const end = findJpegEnd(bytes, index);
      if (end > 0) {
        addResource('image', 'jpg', 'image/jpeg', index, end);
        index = end - 1;
      }
      continue;
    }

    const hasGifHeader =
      bytes[index] === 0x47 &&
      bytes[index + 1] === 0x49 &&
      bytes[index + 2] === 0x46 &&
      bytes[index + 3] === 0x38 &&
      (bytes[index + 4] === 0x37 || bytes[index + 4] === 0x39) &&
      bytes[index + 5] === 0x61;

    if (hasGifHeader) {
      const end = findGifEnd(bytes, index);
      if (end > 0) {
        addResource('image', 'gif', 'image/gif', index, end);
        index = end - 1;
      }
      continue;
    }

    const hasPdfHeader =
      bytes[index] === 0x25 &&
      bytes[index + 1] === 0x50 &&
      bytes[index + 2] === 0x44 &&
      bytes[index + 3] === 0x46;

    if (hasPdfHeader) {
      const end = findPdfEnd(bytes, index);
      if (end > 0) {
        addResource('attachment', 'pdf', 'application/pdf', index, end);
        index = end - 1;
      }
      continue;
    }

    const hasZipHeader =
      bytes[index] === 0x50 &&
      bytes[index + 1] === 0x4B &&
      bytes[index + 2] === 0x03 &&
      bytes[index + 3] === 0x04;

    if (hasZipHeader) {
      const end = findZipEnd(bytes, index);
      if (end > 0) {
        addResource('attachment', 'zip', 'application/zip', index, end);
        index = end - 1;
      }
    }
  }

  return resources;
}

function buildPageHtml(pageModelOrTitle, previewLines, mediaResources = [], attachmentResources = [], placeholderHints = []) {
  const pageModel = (pageModelOrTitle && typeof pageModelOrTitle === 'object' && !Array.isArray(pageModelOrTitle))
    ? pageModelOrTitle
    : {
      title: pageModelOrTitle,
      lines: Array.isArray(previewLines) ? previewLines : []
    };

  const titleEscaped = escapeHtml(pageModel.title || 'Untitled Page');
  const lines = Array.isArray(pageModel.lines) && pageModel.lines.length > 0
    ? pageModel.lines
    : ['No page text preview could be extracted from this native section content in the current heuristic pass.'];

  const blocks = Array.isArray(pageModel.blocks) ? pageModel.blocks : buildStructuredBlocks(lines);
  const contentHtml = renderStructuredBlocks(blocks);
  const metadataItems = Array.isArray(pageModel.metadataItems) ? pageModel.metadataItems : extractDetectedMetadata(lines);
  const metadataHtml = metadataItems.length > 0
    ? `<section><h2>Detected metadata</h2><dl>${metadataItems.map((item) => `<dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd>`).join('')}</dl></section>`
    : '';

  const mediaHtml = Array.isArray(mediaResources) && mediaResources.length > 0
    ? `<section><h2>Detected embedded media</h2>${mediaResources.map((resource, index) => `<figure><img src="${escapeHtml(resource.relativePath || resource.dataUri || '')}" alt="Embedded media ${index + 1}" /><figcaption>${escapeHtml(String(resource.fileName || 'image'))} · ${escapeHtml(String(resource.size))} bytes</figcaption></figure>`).join('')}</section>`
    : '';

  const attachmentsHtml = Array.isArray(attachmentResources) && attachmentResources.length > 0
    ? `<section><h2>Detected attachments</h2><ul>${attachmentResources.map((resource) => `<li><a href="${escapeHtml(resource.relativePath || '#')}" download>${escapeHtml(resource.fileName || 'attachment')}</a> <small>(${escapeHtml(String(resource.size))} bytes)</small></li>`).join('')}</ul></section>`
    : '';

  const placeholdersHtml = Array.isArray(placeholderHints) && placeholderHints.length > 0
    ? `<section><h2>Detected object placeholders</h2><ul>${placeholderHints.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`
    : '';

  const fallbackList = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const bodyContent = contentHtml || `<ul>${fallbackList}</ul>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titleEscaped}</title></head><body><main><h1>${titleEscaped}</h1><p>Converted from native OneNote section with heuristic extraction.</p><h2>Extracted content</h2>${bodyContent}${metadataHtml}${mediaHtml}${attachmentsHtml}${placeholdersHtml}</main></body></html>`;
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
  const embeddedResources = extractEmbeddedResources(bytes, { maxResources: 12, maxBytesPerResource: 600000 });
  const mediaResources = embeddedResources.filter((item) => item.kind === 'image');
  const attachmentResources = embeddedResources.filter((item) => item.kind === 'attachment');
  const placeholderHints = extractObjectPlaceholderHints([...extractedRecords, ...extractedUtf8Records]);
  const mappedResources = embeddedResources.map((resource) => ({
    ...resource,
    path: `${sectionFolder}/_resources/${resource.fileName}`,
    relativePath: `_resources/${resource.fileName}`
  }));
  const pageDescriptors = extractPageDescriptors(extractedRecords);
  const blockedValues = new Set(pageDescriptors.map((item) => item.title));
  const semanticPages = buildSemanticPageModels(
    extractedRecords,
    extractedUtf8Records,
    pageDescriptors,
    blockedValues,
    bytes.length
  );

  const pages = semanticPages.models.map((pageModel) => {
    const title = pageModel.title || 'Page';
    const safeTitle = toFolderSafeName(title);

    const pageMediaResources = mediaResources.map((resource) => ({
      ...resource,
      relativePath: `_resources/${resource.fileName}`
    }));
    const pageAttachmentResources = attachmentResources.map((resource) => ({
      ...resource,
      relativePath: `_resources/${resource.fileName}`
    }));

    return {
      name: title,
      path: `${sectionFolder}/${safeTitle}.html`,
      html: buildPageHtml(pageModel, null, pageMediaResources, pageAttachmentResources, placeholderHints),
      metadata: pageModel.metadata || {
        title,
        author: undefined,
        createdAt: undefined,
        modifiedAt: undefined
      },
      resources: mappedResources
    };
  });

  const metadataConflictCount = semanticPages.models.reduce(
    (total, pageModel) => total + (Array.isArray(pageModel.metadataConflicts) ? pageModel.metadataConflicts.length : 0),
    0
  );
  const metadataPriorityReplacementCount = semanticPages.models.reduce(
    (total, pageModel) => total + (Array.isArray(pageModel.metadataConflicts)
      ? pageModel.metadataConflicts.filter((item) => item && item.resolution === 'replaced-by-priority').length
      : 0),
    0
  );

  const hierarchyChildren = pages.map((page) => ({
    kind: 'page',
    name: page.name,
    path: page.path,
    children: []
  }));

  const warningDetails = [
    makeWarning(WARNING_CODES.one.signatureValidated, 'Section file signature validated.'),
    makeWarning(WARNING_CODES.one.structuredModelsSummary, `Structured parser generated ${pages.length} page model(s) from ${pageDescriptors.length} title descriptor(s).`),
    makeWarning(WARNING_CODES.one.fallbackSemanticSummary, `Fallback semantic line pool size: ${semanticPages.fallbackPoolSize}; filtered out ${semanticPages.filteredOutCount} low-confidence line(s); fallback used on ${semanticPages.fallbackPageCount} page(s).`),
    makeWarning(WARNING_CODES.one.metadataCanonicalizationSummary, `Metadata canonicalization produced ${pages.length} page metadata object(s) with ${metadataConflictCount} conflict(s); ${metadataPriorityReplacementCount} replaced via source-priority rules.`),
    makeWarning(WARNING_CODES.one.embeddedResourceScanSummary, `Detected ${mediaResources.length} embedded image candidate(s) and ${attachmentResources.length} attachment candidate(s) via binary signature scan.`),
    makeWarning(WARNING_CODES.one.placeholderHintsSummary, `Detected ${placeholderHints.length} object-placeholder hint(s) from native text records.`)
  ];

  return {
    sourceKind: 'one',
    hierarchy: {
      kind: 'section',
      name: sectionName,
      path: `${sectionFolder}/`,
      children: hierarchyChildren
    },
    pages,
    warningDetails,
    warnings: toWarningMessages(warningDetails)
  };
}