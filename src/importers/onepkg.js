import { baseNameFromFile, toFolderSafeName } from './sourceKind.js';
import { importOneSection } from './one.js';
import { WARNING_CODES, makeWarning, toWarningMessages } from './warnings.js';
import { inflateSync } from '../../node_modules/fflate/esm/browser.js';

let libarchiveModulePromise = null;

async function getLibarchiveArchive() {
  if (!libarchiveModulePromise) {
    libarchiveModulePromise = import('../../node_modules/libarchive.js/dist/libarchive.js');
  }

  const module = await libarchiveModulePromise;
  if (!module || !module.Archive) {
    throw new Error('libarchive.js did not expose Archive export');
  }

  return module.Archive;
}

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
  const flags = readUInt16(view, 30);
  const cbCabinet = readUInt32(view, 8);

  if (coffFiles <= 0 || coffFiles >= bytes.length) {
    throw new Error('Invalid .onepkg cabinet file table offset');
  }

  let cbCFHeader = 0;
  let cbCFFolder = 0;
  let cbCFData = 0;
  let folderOffset = 36;

  if ((flags & 0x0004) !== 0) {
    if (bytes.length < 40) {
      throw new Error('Invalid .onepkg cabinet reserve header');
    }
    cbCFHeader = readUInt16(view, 36);
    cbCFFolder = bytes[38] || 0;
    cbCFData = bytes[39] || 0;
    folderOffset = 40 + cbCFHeader;
    if (folderOffset > bytes.length) {
      throw new Error('Invalid .onepkg reserve sizes exceed cabinet length');
    }
  }

  const folders = [];

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
    folderOffset += 8 + cbCFFolder;
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
    flags,
    cbCFHeader,
    cbCFFolder,
    cbCFData,
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

function decodeMszipBlock(blockBytes, expectedSize) {
  if (!blockBytes || blockBytes.length < 2) {
    throw new Error('Invalid MSZIP CFDATA block: missing signature bytes');
  }

  if (blockBytes[0] !== 0x43 || blockBytes[1] !== 0x4B) {
    throw new Error('Invalid MSZIP CFDATA block: expected CK signature');
  }

  const rawDeflate = blockBytes.subarray(2);
  const inflated = inflateSync(rawDeflate);
  if (!(inflated instanceof Uint8Array)) {
    throw new Error('MSZIP inflate returned invalid output');
  }

  if (typeof expectedSize === 'number' && expectedSize > 0 && inflated.length !== expectedSize) {
    throw new Error(`MSZIP block size mismatch: expected ${expectedSize}, got ${inflated.length}`);
  }

  return inflated;
}

function extractFolderData(bytes, folder, options = {}) {
  if (!folder || folder.coffCabStart <= 0 || folder.coffCabStart >= bytes.length) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const compression = decodeCompressionType(folder.typeCompress);
  const cbCFData = typeof options.cbCFData === 'number' ? options.cbCFData : 0;
  const lzxDecoder = typeof options.lzxDecoder === 'function' ? options.lzxDecoder : null;

  if (compression !== 'none' && compression !== 'mszip' && compression !== 'lzx') {
    return null;
  }

  if (compression === 'lzx' && !lzxDecoder) {
    return null;
  }

  let cursor = folder.coffCabStart;
  const chunks = [];
  let totalLength = 0;

  for (let index = 0; index < folder.cCFData; index += 1) {
    if (cursor + 8 > bytes.length) break;
    const cbData = readUInt16(view, cursor + 4);
    const cbUncomp = readUInt16(view, cursor + 6);
    const dataStart = cursor + 8 + cbCFData;
    const dataEnd = dataStart + cbData;
    if (dataEnd > bytes.length) break;

    const chunk = bytes.slice(dataStart, dataEnd);
    let outputChunk;

    if (compression === 'none') {
      if (cbData !== cbUncomp) {
        return null;
      }
      outputChunk = chunk;
    } else if (compression === 'mszip') {
      try {
        outputChunk = decodeMszipBlock(chunk, cbUncomp);
      } catch (_error) {
        return null;
      }
    } else {
      try {
        outputChunk = lzxDecoder(chunk, {
          expectedSize: cbUncomp,
          folder,
          blockIndex: index
        });
      } catch (_error) {
        return null;
      }

      if (!(outputChunk instanceof Uint8Array) || outputChunk.length === 0) {
        return null;
      }
    }

    chunks.push(outputChunk);
    totalLength += outputChunk.length;
    cursor = dataEnd;
  }

  if (chunks.length === 0) {
    return null;
  }

  const output = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  return output;
}

function buildFolderDataMap(arrayBuffer, folders, options = {}) {
  const bytes = new Uint8Array(arrayBuffer);
  const map = new Map();
  const summary = {
    decodedFolderCount: 0,
    failedFolderCount: 0,
    decodedCompressionKinds: new Set(),
    failedCompressionKinds: new Set()
  };

  for (const folder of folders) {
    const compression = decodeCompressionType(folder.typeCompress);
    const rawData = extractFolderData(bytes, folder, options);
    if (rawData) {
      map.set(folder.index, rawData);
      summary.decodedFolderCount += 1;
      summary.decodedCompressionKinds.add(compression);
    } else {
      summary.failedFolderCount += 1;
      summary.failedCompressionKinds.add(compression);
    }
  }

  return {
    map,
    summary: {
      ...summary,
      decodedCompressionKinds: [...summary.decodedCompressionKinds],
      failedCompressionKinds: [...summary.failedCompressionKinds]
    }
  };
}

function normalizeEntryPath(value = '') {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function toArchiveInputFile(arrayBuffer, fileName) {
  const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
  if (typeof File === 'function') {
    return new File([blob], fileName || 'Notebook.onepkg', { type: 'application/octet-stream' });
  }
  blob.name = fileName || 'Notebook.onepkg';
  return blob;
}

async function extractSectionBytesViaLibarchive(arrayBuffer, fileName) {
  const sectionMap = new Map();
  const extractedPaths = [];
  const warningDetails = [];
  let archive = null;

  try {
    const Archive = await getLibarchiveArchive();
    archive = await Archive.open(toArchiveInputFile(arrayBuffer, fileName));
    const fileArray = await archive.getFilesArray();

    for (const entry of fileArray) {
      if (!entry || !entry.file) continue;
      const relPath = normalizeEntryPath(`${entry.path || ''}${entry.file.name || ''}`);
      if (!/\.one$/i.test(relPath)) continue;

      const extracted = await entry.file.extract();
      const extractedBuffer = await extracted.arrayBuffer();
      sectionMap.set(relPath, new Uint8Array(extractedBuffer));
      extractedPaths.push(relPath);
    }
  } catch (error) {
    warningDetails.push(makeWarning(
      WARNING_CODES.onepkg.libarchiveExtractFailed,
      `libarchive.js extraction failed: ${String(error && error.message ? error.message : error)}`,
      'warning'
    ));
  } finally {
    if (archive && typeof archive.close === 'function') {
      try {
        await archive.close();
      } catch (_ignored) {
        // no-op
      }
    }
  }

  return {
    sectionMap,
    extractedPaths,
    warningDetails,
    warnings: toWarningMessages(warningDetails)
  };
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
  const sectionLogicalPath = [notebookName, ...groupParts, sectionName].join('/');

  const baseMetadata = {
    title: sectionName,
    author: undefined,
    createdAt: undefined,
    modifiedAt: undefined,
    notebook: notebookName,
    sectionPath: sectionLogicalPath,
    source: 'onepkg'
  };

  if (sectionBytes) {
    try {
      const sectionOffset = sectionBytes.byteOffset;
      const sectionArrayBuffer = sectionBytes.buffer.slice(sectionOffset, sectionOffset + sectionBytes.byteLength);
      const sectionResult = importOneSection(sectionArrayBuffer, { fileName: `${sectionName}.one` });
      if (sectionResult && Array.isArray(sectionResult.pages) && sectionResult.pages.length > 0) {
        const mappedPages = sectionResult.pages.map((page) => {
          const safePageName = toFolderSafeName(page.name || 'Page');
          const mappedResources = Array.isArray(page.resources)
            ? page.resources.map((resource) => {
              const originalPath = String(resource && resource.path ? resource.path : resource && resource.fileName ? resource.fileName : 'resource.bin');
              const fileName = originalPath.split('/').pop();
              return {
                ...resource,
                path: `${sectionFolderPath}/_resources/${fileName}`,
                relativePath: `_resources/${fileName}`
              };
            })
            : [];

          return {
            name: page.name || 'Page',
            path: `${sectionFolderPath}/${safePageName}.html`,
            html: page.html || buildOnePkgSectionPageHtml(notebookName, entryPath, sectionName),
            metadata: {
              ...baseMetadata,
              ...(page && typeof page.metadata === 'object' ? page.metadata : {}),
              sectionPath: sectionLogicalPath,
              notebook: notebookName,
              source: 'onepkg->one'
            },
            resources: mappedResources
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
    html: buildOnePkgSectionPageHtml(notebookName, entryPath, sectionName),
    metadata: baseMetadata
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

async function deriveSectionPagesWithExtraction(notebookName, notebookFolder, parsed) {
  const { map: folderData, summary: folderDecodeSummary } = buildFolderDataMap(parsed.arrayBuffer, parsed.folders, {
    cbCFData: parsed.cbCFData,
    lzxDecoder: parsed.lzxDecoder
  });

  let libarchiveSectionMap = new Map();
  const libarchiveWarningDetails = [];
  const compressionKinds = parsed.folders.map((folder) => decodeCompressionType(folder.typeCompress));
  const hasLzx = compressionKinds.includes('lzx');
  if (hasLzx) {
    const archiveExtract = await extractSectionBytesViaLibarchive(parsed.arrayBuffer, parsed.fileName || 'Notebook.onepkg');
    libarchiveSectionMap = archiveExtract.sectionMap;
    libarchiveWarningDetails.push(...(Array.isArray(archiveExtract.warningDetails) ? archiveExtract.warningDetails : []));
  }

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
    const mappedSectionBytes = libarchiveSectionMap.get(entryPath);
    if (mappedSectionBytes) {
      sectionBytes = mappedSectionBytes;
    }

    const folderBytes = folderData.get(entry.folderIndex);
    if (!sectionBytes && folderBytes && entry.uncompressedOffset >= 0 && entry.size >= 0) {
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
    decodedFolderCount: folderData.size,
    folderDecodeSummary,
    libarchiveExtractedSectionCount: libarchiveSectionMap.size,
    libarchiveWarningDetails,
    libarchiveWarnings: toWarningMessages(libarchiveWarningDetails)
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

export async function importOnePackage(arrayBuffer, options = {}) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error('Expected binary .onepkg payload as ArrayBuffer');
  }

  const parsedBase = parseCabEntries(arrayBuffer);
  const parsed = {
    ...parsedBase,
    arrayBuffer,
    fileName: options.fileName || 'Notebook.onepkg',
    lzxDecoder: options.lzxDecoder
  };
  const notebookName = baseNameFromFile(options.fileName || 'Notebook.onepkg');
  const notebookFolder = toFolderSafeName(notebookName);
  const compressionKinds = parsed.folders.map((folder) => decodeCompressionType(folder.typeCompress));
  const hasUnsupportedCompression = compressionKinds.some((kind) => kind !== 'none' && kind !== 'mszip');

  const {
    pages,
    sectionDescriptors,
    extractedSectionCount,
    decodedFolderCount,
    folderDecodeSummary,
    libarchiveExtractedSectionCount,
    libarchiveWarningDetails
  } = await deriveSectionPagesWithExtraction(notebookName, notebookFolder, parsed);

  const hierarchy = buildSectionHierarchy(notebookName, notebookFolder, sectionDescriptors);

  const warningDetails = [
    makeWarning(WARNING_CODES.onepkg.cabParsedSummary, `Parsed CAB container with ${parsed.entryCount} entries across ${parsed.folderCount} folder(s).`),
    makeWarning(WARNING_CODES.onepkg.sectionsGeneratedSummary, `Detected ${sectionDescriptors.length} section file(s) and generated ${pages.length} downloadable page(s).`),
    makeWarning(WARNING_CODES.onepkg.deepExtractionSummary, `Deep extraction succeeded for ${extractedSectionCount} section(s).`),
    makeWarning(WARNING_CODES.onepkg.folderDecodeSummary, `Decoded ${decodedFolderCount}/${parsed.folderCount} CAB folder payload(s) in-browser.`)
  ];

  if (libarchiveExtractedSectionCount > 0) {
    warningDetails.push(makeWarning(WARNING_CODES.onepkg.libarchiveExtractSummary, `libarchive.js extracted ${libarchiveExtractedSectionCount} section payload(s) from compressed archive entries.`));
  }

  warningDetails.push(...(Array.isArray(libarchiveWarningDetails) ? libarchiveWarningDetails : []));

  if (folderDecodeSummary.failedCompressionKinds.length > 0 && libarchiveExtractedSectionCount === 0) {
    warningDetails.push(makeWarning(WARNING_CODES.onepkg.folderDecodeFailedKinds, `Failed folder decode kinds: ${folderDecodeSummary.failedCompressionKinds.join(', ')}.`, 'warning'));
  }

  if (hasUnsupportedCompression) {
    if (libarchiveExtractedSectionCount > 0) {
      warningDetails.push(makeWarning(WARNING_CODES.onepkg.unsupportedCompressionWithFallback, `Detected unsupported CAB compression kinds (${compressionKinds.join(', ')}), but libarchive.js fallback decoded section payloads for extraction.`, 'warning'));
    } else {
      warningDetails.push(makeWarning(WARNING_CODES.onepkg.unsupportedCompressionPlaceholders, `Some CAB folders use unsupported compression (${compressionKinds.join(', ')}); placeholders are used where bytes cannot be decoded in-browser.`, 'warning'));
      warningDetails.push(makeWarning(WARNING_CODES.onepkg.lzxDecoderHint, 'LZX support requires a WASM decoder hook (`options.lzxDecoder`) or libarchive.js extraction fallback to decode compressed payloads.'));
    }
  } else if (decodedFolderCount === 0) {
    warningDetails.push(makeWarning(WARNING_CODES.onepkg.noFolderDecode, 'No CAB folder payloads were decoded for direct section-byte extraction.', 'warning'));
  }

  const warnings = toWarningMessages(warningDetails);

  return {
    sourceKind: 'onepkg',
    hierarchy,
    pages,
    warningDetails,
    warnings,
    archiveEntries: parsed.entries
  };
}