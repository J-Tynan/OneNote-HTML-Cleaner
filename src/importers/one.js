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

function splitTableCells(line) {
  const value = String(line || '').trim();
  if (!value) return null;

  if (value.includes('\t')) {
    const cells = value.split('\t').map((cell) => cell.trim());
    const nonEmptyCount = cells.filter((cell) => cell.length > 0).length;
    if (cells.length >= 2 && nonEmptyCount >= 2) {
      return cells;
    }
  }

  if (value.includes('|')) {
    const rawCells = value.split('|').map((cell) => cell.trim());
    const cells = rawCells.filter((cell) => cell.length > 0);
    if (cells.length >= 2) {
      return cells;
    }
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

function buildStructuredBlocks(lines) {
  const blocks = [];
  let listState = null;
  let tableState = null;

  const flushList = () => {
    if (listState && listState.items.length > 0) {
      blocks.push({ kind: listState.kind, items: listState.items.slice() });
    }
    listState = null;
  };

  const flushTable = () => {
    if (tableState && tableState.rows.length > 0) {
      blocks.push({ kind: 'table', rows: tableState.rows.slice() });
    }
    tableState = null;
  };

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line) {
      flushList();
      flushTable();
      continue;
    }

    const tableCells = splitTableCells(line);
    if (tableCells) {
      flushList();
      if (!tableState) {
        tableState = { rows: [tableCells], columnCount: tableCells.length };
      } else if (tableState.columnCount === tableCells.length) {
        tableState.rows.push(tableCells);
      } else {
        flushTable();
        tableState = { rows: [tableCells], columnCount: tableCells.length };
      }
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

    const heading = toHeadingLevel(line);
    if (heading && heading.text.length > 0) {
      blocks.push({ kind: 'heading', level: heading.level, text: heading.text });
    } else {
      blocks.push({ kind: 'paragraph', text: line });
    }
  }

  flushList();
  flushTable();

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
      const hasHeader = rows.length > 1 && firstRow.some((cell) => /[A-Za-z]/.test(String(cell || '')));

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
  const items = [];
  const seen = new Set();
  const dateRegex = /\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/;
  const timeRegex = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;

  for (const line of lines) {
    if (!line) continue;
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

  return items;
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

function extractEmbeddedImages(bytes, options = {}) {
  const maxImages = typeof options.maxImages === 'number' ? options.maxImages : 6;
  const maxBytesPerImage = typeof options.maxBytesPerImage === 'number' ? options.maxBytesPerImage : 400000;
  const images = [];

  const addImage = (kind, start, end) => {
    if (images.length >= maxImages) return;
    if (start < 0 || end <= start || end > bytes.length) return;

    const length = end - start;
    if (length < 64 || length > maxBytesPerImage) return;

    const blob = bytes.slice(start, end);
    const mimeType = kind === 'png'
      ? 'image/png'
      : (kind === 'jpeg' ? 'image/jpeg' : 'image/gif');

    images.push({
      kind,
      mimeType,
      size: length,
      dataUri: `data:${mimeType};base64,${uint8ArrayToBase64(blob)}`
    });
  };

  for (let index = 0; index < bytes.length && images.length < maxImages; index += 1) {
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
        addImage('png', index, end);
        index = end - 1;
      }
      continue;
    }

    if (bytes[index] === 0xFF && bytes[index + 1] === 0xD8) {
      const end = findJpegEnd(bytes, index);
      if (end > 0) {
        addImage('jpeg', index, end);
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
        addImage('gif', index, end);
        index = end - 1;
      }
    }
  }

  return images;
}

function buildPageHtml(title, previewLines, embeddedImages = []) {
  const titleEscaped = escapeHtml(title || 'Untitled Page');
  const lines = Array.isArray(previewLines) && previewLines.length > 0
    ? previewLines
    : ['No page text preview could be extracted from this native section content in the current heuristic pass.'];

  const blocks = buildStructuredBlocks(lines);
  const contentHtml = renderStructuredBlocks(blocks);
  const metadataItems = extractDetectedMetadata(lines);
  const metadataHtml = metadataItems.length > 0
    ? `<section><h2>Detected metadata</h2><dl>${metadataItems.map((item) => `<dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd>`).join('')}</dl></section>`
    : '';

  const mediaHtml = Array.isArray(embeddedImages) && embeddedImages.length > 0
    ? `<section><h2>Detected embedded media</h2>${embeddedImages.map((image, index) => `<figure><img src="${image.dataUri}" alt="Embedded media ${index + 1}" /><figcaption>${escapeHtml(image.kind.toUpperCase())} · ${escapeHtml(String(image.size))} bytes</figcaption></figure>`).join('')}</section>`
    : '';

  const fallbackList = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const bodyContent = contentHtml || `<ul>${fallbackList}</ul>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titleEscaped}</title></head><body><main><h1>${titleEscaped}</h1><p>Converted from native OneNote section with heuristic extraction.</p><h2>Extracted content</h2>${bodyContent}${metadataHtml}${mediaHtml}</main></body></html>`;
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
  const embeddedImages = extractEmbeddedImages(bytes, { maxImages: 6, maxBytesPerImage: 400000 });
  const pageDescriptors = extractPageDescriptors(extractedRecords);
  const blockedValues = new Set(pageDescriptors.map((item) => item.title));
  const fallbackPreviewLines = mergeUniqueLines(
    extractPreviewLines(extractedRecords, blockedValues),
    extractPreviewLines(extractedUtf8Records, blockedValues),
    24
  );

  const pages = pageDescriptors.map((descriptor, index) => {
    const nextDescriptor = pageDescriptors[index + 1] || null;
    const title = descriptor.title || `Page ${index + 1}`;
    const safeTitle = toFolderSafeName(title);

    const wideLines = extractPreviewLinesForPage(extractedRecords, descriptor, nextDescriptor, fallbackPreviewLines, blockedValues, 24);
    const currentRecord = descriptor.titleIndex >= 0 ? extractedRecords[descriptor.titleIndex] : extractedRecords[descriptor.markerIndex];
    const nextRecord = nextDescriptor
      ? (nextDescriptor.titleIndex >= 0 ? extractedRecords[nextDescriptor.titleIndex] : extractedRecords[nextDescriptor.markerIndex])
      : null;
    const rangeStart = currentRecord ? currentRecord.startOffset : 0;
    const rangeEnd = nextRecord ? nextRecord.startOffset : bytes.length;
    const utf8Lines = extractPreviewLinesFromRange(extractedUtf8Records, rangeStart, rangeEnd, blockedValues, 24);
    const previewLines = mergeUniqueLines(wideLines, utf8Lines, 24);

    return {
      name: title,
      path: `${sectionFolder}/${safeTitle}.html`,
      html: buildPageHtml(title, previewLines, embeddedImages)
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
      `Extracted ${pages.length} page title(s) and page-specific text previews using native metadata heuristics.`,
      `Detected ${embeddedImages.length} embedded image candidate(s) via binary signature scan.`
    ]
  };
}