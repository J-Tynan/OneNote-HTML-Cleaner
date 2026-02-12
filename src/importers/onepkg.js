import { baseNameFromFile, toFolderSafeName } from './sourceKind.js';
import { importOneSection } from './one.js';

function readUInt16(view, offset) {
  return view.getUint16(offset, true);
}

function readUInt32(view, offset) {
  return view.getUint32(offset, true);
}

function readNullTerminatedString(bytes, startOffset) {
  let end = startOffset;
  while (end < bytes.length && bytes[end] !== 0) {
    end += 1;
  }
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(bytes.slice(startOffset, end));
  return { text, nextOffset: Math.min(end + 1, bytes.length) };
}

function parseCabEntries(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length < 36) {
    throw new Error('Invalid .onepkg file: CAB header is too small');
  }

  const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (signature !== 'MSCF') {
    throw new Error('Invalid .onepkg signature: expected CAB header (MSCF)');
  }

  const coffFiles = readUInt32(view, 16);
  const cFolders = readUInt16(view, 26);
  const cFiles = readUInt16(view, 28);
  const cbCabinet = readUInt32(view, 8);

  if (coffFiles <= 0 || coffFiles >= bytes.length) {
    throw new Error('Invalid .onepkg cabinet file table offset');
  }

  const folders = [];
  let folderOffset = 36;

  for (let index = 0; index < cFolders; index += 1) {
    if (folderOffset + 8 > bytes.length) {
      throw new Error('Invalid .onepkg folder table');
    }
    folders.push({
      index,
      coffCabStart: readUInt32(view, folderOffset),
      cCFData: readUInt16(view, folderOffset + 4),
      typeCompress: readUInt16(view, folderOffset + 6)
    });
    folderOffset += 8;
  }

  const entries = [];
  let offset = coffFiles;

  for (let i = 0; i < cFiles; i += 1) {
    if (offset + 16 > bytes.length) {
      break;
    }

    const uncompressedOffset = readUInt32(view, offset);
    const cbFile = readUInt32(view, offset + 4);
    const attrs = readUInt16(view, offset + 12);
    const folderIndexRaw = readUInt16(view, offset + 14);
    const folderIndex = folderIndexRaw < folders.length
      ? folderIndexRaw
      : (folders.length === 1 ? 0 : -1);
    const nameResult = readNullTerminatedString(bytes, offset + 16);
    const name = nameResult.text || `entry_${i}`;

    entries.push({
      index: i,
      name,
      size: cbFile,
      uncompressedOffset,
      attributes: attrs,
      folderIndex,
      folderIndexRaw
    });

    offset = nameResult.nextOffset;
  }

  return {
    cbCabinet,
    folderCount: cFolders,
    folders,
    entryCount: cFiles,
    entries
  };
}

function decodeCompressionType(typeCompress) {
  const kind = typeCompress & 0x000f;
  if (kind === 0x0000) return 'none';
  if (kind === 0x0001) return 'mszip';
  if (kind === 0x0002) return 'quantum';
  if (kind === 0x0003) return 'lzx';
  return 'unknown';
}

function extractFolderUncompressedData(bytes, folder) {
  if (!folder || folder.coffCabStart <= 0 || folder.coffCabStart >= bytes.length) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const compression = decodeCompressionType(folder.typeCompress);
  if (compression !== 'none') {
    return null;
  }

  let cursor = folder.coffCabStart;
  const chunks = [];
  let totalLength = 0;

  for (let index = 0; index < folder.cCFData; index += 1) {
    if (cursor + 8 > bytes.length) break;
    const cbData = readUInt16(view, cursor + 4);
    const cbUncomp = readUInt16(view, cursor + 6);
    const dataStart = cursor + 8;
    const dataEnd = dataStart + cbData;
    if (dataEnd > bytes.length) break;
    if (cbData !== cbUncomp) {
      return null;
    }
    const chunk = bytes.slice(dataStart, dataEnd);
    chunks.push(chunk);
    totalLength += chunk.length;
    cursor = dataEnd;
  }

  const output = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  return output;
}

function buildFolderDataMap(arrayBuffer, folders) {
  const bytes = new Uint8Array(arrayBuffer);
  const map = new Map();

  for (const folder of folders) {
    const rawData = extractFolderUncompressedData(bytes, folder);
    if (rawData) {
      map.set(folder.index, rawData);
    }
  }

  return map;
}

function normalizeEntryPath(value = '') {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function splitPath(value = '') {
  const normalized = normalizeEntryPath(value);
  return normalized ? normalized.split('/').filter(Boolean) : [];
}

function joinPath(parts) {
  return parts.filter(Boolean).join('/');
}

function stripExtension(name = '') {
  return String(name || '').replace(/\.[^.]+$/i, '');
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

function buildOnePkgSectionPageHtml(notebookName, sectionPath, sectionName) {
  const notebookEscaped = escapeHtml(notebookName);
  const sectionEscaped = escapeHtml(sectionName);
  const sectionPathEscaped = escapeHtml(sectionPath);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${sectionEscaped}</title></head><body><main><h1>${sectionEscaped}</h1><p>Converted from OneNote notebook package <strong>${notebookEscaped}</strong>.</p><p>Section path: <code>${sectionPathEscaped}</code></p><p>Detailed page extraction from .onepkg section binaries is in progress. This placeholder keeps the notebook hierarchy and enables per-section download today.</p></main></body></html>`;
}

function ensureChildNode(parent, kind, name, path) {
  const children = Array.isArray(parent.children) ? parent.children : [];
  parent.children = children;
  let child = children.find((item) => item.kind === kind && item.name === name);
  if (!child) {
    child = { kind, name, path, children: [] };
    children.push(child);
  }
  return child;
}

function deriveSectionPages(notebookName, notebookFolder, entries) {
  const pages = [];
  const sectionDescriptors = [];

  for (const entry of entries) {
    const entryPath = normalizeEntryPath(entry.name);
    if (!/\.one$/i.test(entryPath)) continue;

    const parts = splitPath(entryPath);
    if (parts.length === 0) continue;
    const fileName = parts[parts.length - 1];
    const sectionName = stripExtension(fileName);
    const groupParts = parts.slice(0, -1).map((item) => stripExtension(item));

    const safeGroupParts = groupParts.map((item) => toFolderSafeName(item));
    const safeSectionName = toFolderSafeName(sectionName);
    const sectionFolderParts = [notebookFolder, ...safeGroupParts, safeSectionName];
    const sectionFolderPath = joinPath(sectionFolderParts);
    const pagePath = `${sectionFolderPath}/${safeSectionName}.html`;

    pages.push({
      name: sectionName,
      path: pagePath,
      html: buildOnePkgSectionPageHtml(notebookName, entryPath, sectionName)
    });

    sectionDescriptors.push({
      sectionName,
      groupParts,
      safeGroupParts,
      safeSectionName,
      sectionFolderPath,
      pagePath
    });
  }

  return { pages, sectionDescriptors };
}

function buildSectionPagesFromEntry(notebookName, notebookFolder, entryPath, sectionName, sectionBytes) {
  const parts = splitPath(entryPath);
  const groupParts = parts.slice(0, -1).map((item) => stripExtension(item));
  const safeGroupParts = groupParts.map((item) => toFolderSafeName(item));
  const safeSectionName = toFolderSafeName(sectionName);
  const sectionFolderParts = [notebookFolder, ...safeGroupParts, safeSectionName];
  const sectionFolderPath = joinPath(sectionFolderParts);

  if (sectionBytes) {
    try {
      const sectionOffset = sectionBytes.byteOffset;
      const sectionArrayBuffer = sectionBytes.buffer.slice(sectionOffset, sectionOffset + sectionBytes.byteLength);
      const sectionResult = importOneSection(sectionArrayBuffer, { fileName: `${sectionName}.one` });
      if (sectionResult && Array.isArray(sectionResult.pages) && sectionResult.pages.length > 0) {
        const mappedPages = sectionResult.pages.map((page) => {
          const safePageName = toFolderSafeName(page.name || 'Page');
          return {
            name: page.name || 'Page',
            path: `${sectionFolderPath}/${safePageName}.html`,
            html: page.html || buildOnePkgSectionPageHtml(notebookName, entryPath, sectionName)
          };
        });

        return {
          pages: mappedPages,
          descriptor: {
            sectionName,
            groupParts,
            safeGroupParts,
            safeSectionName,
            sectionFolderPath,
            pagePaths: mappedPages.map((item) => ({ name: item.name, path: item.path }))
          },
          extractedFromSection: true
        };
      }
    } catch (_err) {
      // Fall through to placeholder behavior.
    }
  }

  const placeholderPath = `${sectionFolderPath}/${safeSectionName}.html`;
  const placeholderPage = {
    name: sectionName,
    path: placeholderPath,
    html: buildOnePkgSectionPageHtml(notebookName, entryPath, sectionName)
  };

  return {
    pages: [placeholderPage],
    descriptor: {
      sectionName,
      groupParts,
      safeGroupParts,
      safeSectionName,
      sectionFolderPath,
      pagePaths: [{ name: sectionName, path: placeholderPath }]
    },
    extractedFromSection: false
  };
}

function deriveSectionPagesWithExtraction(notebookName, notebookFolder, parsed) {
  const folderData = buildFolderDataMap(parsed.arrayBuffer, parsed.folders);
  const pages = [];
  const sectionDescriptors = [];
  let extractedSectionCount = 0;

  for (const entry of parsed.entries) {
    const entryPath = normalizeEntryPath(entry.name);
    if (!/\.one$/i.test(entryPath)) continue;
    const parts = splitPath(entryPath);
    if (parts.length === 0) continue;
    const fileName = parts[parts.length - 1];
    const sectionName = stripExtension(fileName);

    let sectionBytes = null;
    const folderBytes = folderData.get(entry.folderIndex);
    if (folderBytes && entry.uncompressedOffset >= 0 && entry.size >= 0) {
      const start = entry.uncompressedOffset;
      const end = start + entry.size;
      if (end <= folderBytes.length) {
        sectionBytes = folderBytes.slice(start, end);
      }
    }

    const sectionResult = buildSectionPagesFromEntry(notebookName, notebookFolder, entryPath, sectionName, sectionBytes);
    pages.push(...sectionResult.pages);
    sectionDescriptors.push(sectionResult.descriptor);
    if (sectionResult.extractedFromSection) {
      extractedSectionCount += 1;
    }
  }

  return {
    pages,
    sectionDescriptors,
    extractedSectionCount,
    uncompressedFolderCount: folderData.size
  };
}

function buildSectionHierarchy(notebookName, notebookFolder, sectionDescriptors) {
  const hierarchy = {
    kind: 'notebook',
    name: notebookName,
    path: `${notebookFolder}/`,
    children: []
  };

  for (const descriptor of sectionDescriptors) {
    let cursor = hierarchy;
    const logicalGroupParts = descriptor.groupParts;
    const safeGroupParts = descriptor.safeGroupParts;

    for (let index = 0; index < logicalGroupParts.length; index += 1) {
      const logicalName = logicalGroupParts[index];
      const safeName = safeGroupParts[index];
      const groupPath = `${joinPath([cursor.path.replace(/\/$/, ''), safeName])}/`;
      cursor = ensureChildNode(cursor, 'section-group', logicalName, groupPath);
    }

    const sectionNode = ensureChildNode(cursor, 'section', descriptor.sectionName, `${descriptor.sectionFolderPath}/`);
    const pagePaths = Array.isArray(descriptor.pagePaths) ? descriptor.pagePaths : [];
    for (const pagePath of pagePaths) {
      ensureChildNode(sectionNode, 'page', pagePath.name, pagePath.path);
    }
  }

  return hierarchy;
}

export function importOnePackage(arrayBuffer, options = {}) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error('Expected binary .onepkg payload as ArrayBuffer');
  }

  const parsedBase = parseCabEntries(arrayBuffer);
  const parsed = {
    ...parsedBase,
    arrayBuffer
  };
  const notebookName = baseNameFromFile(options.fileName || 'Notebook.onepkg');
  const notebookFolder = toFolderSafeName(notebookName);
  const compressionKinds = parsed.folders.map((folder) => decodeCompressionType(folder.typeCompress));
  const hasUnsupportedCompression = compressionKinds.some((kind) => kind !== 'none');

  const {
    pages,
    sectionDescriptors,
    extractedSectionCount,
    uncompressedFolderCount
  } = deriveSectionPagesWithExtraction(notebookName, notebookFolder, parsed);

  const hierarchy = buildSectionHierarchy(notebookName, notebookFolder, sectionDescriptors);

  const warnings = [
    `Parsed CAB container with ${parsed.entryCount} entries across ${parsed.folderCount} folder(s).`,
    `Detected ${sectionDescriptors.length} section file(s) and generated ${pages.length} downloadable page(s).`,
    `Deep extraction succeeded for ${extractedSectionCount} section(s).`
  ];

  if (hasUnsupportedCompression) {
    warnings.push(`Some CAB folders use unsupported compression (${compressionKinds.join(', ')}); placeholders are used where bytes cannot be decoded in-browser.`);
    warnings.push('For full content extraction from compressed .onepkg files, export sections/pages to .one or .mht from OneNote and re-import those files.');
  } else if (uncompressedFolderCount === 0) {
    warnings.push('No uncompressed CAB folder payloads were available for direct section-byte extraction.');
  }

  return {
    sourceKind: 'onepkg',
    hierarchy,
    pages,
    warnings,
    archiveEntries: parsed.entries
  };
}