import { baseNameFromFile, toFolderSafeName } from './sourceKind.js';

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
  const cFiles = readUInt16(view, 28);
  const cbCabinet = readUInt32(view, 8);

  if (coffFiles <= 0 || coffFiles >= bytes.length) {
    throw new Error('Invalid .onepkg cabinet file table offset');
  }

  const entries = [];
  let offset = coffFiles;

  for (let i = 0; i < cFiles; i += 1) {
    if (offset + 16 > bytes.length) {
      break;
    }

    const cbFile = readUInt32(view, offset + 4);
    const attrs = readUInt16(view, offset + 12);
    const folderIndex = readUInt16(view, offset + 14);
    const nameResult = readNullTerminatedString(bytes, offset + 16);
    const name = nameResult.text || `entry_${i}`;

    entries.push({
      index: i,
      name,
      size: cbFile,
      attributes: attrs,
      folderIndex
    });

    offset = nameResult.nextOffset;
  }

  return {
    cbCabinet,
    entryCount: cFiles,
    entries
  };
}

function insertPathNode(root, pathValue) {
  const normalized = String(pathValue || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return;
  const parts = normalized.split('/').filter(Boolean);
  let cursor = root;
  let runningPath = root.path;

  for (let i = 0; i < parts.length; i += 1) {
    const segment = parts[i];
    const isLast = i === (parts.length - 1);
    runningPath = `${runningPath}${segment}${isLast ? '' : '/'}`;
    let child = cursor.children.find((item) => item.name === segment);
    if (!child) {
      child = {
        kind: isLast ? 'entry' : 'folder',
        name: segment,
        path: runningPath,
        children: []
      };
      cursor.children.push(child);
    }
    cursor = child;
    if (!isLast && !Array.isArray(cursor.children)) {
      cursor.children = [];
    }
  }
}

export function importOnePackage(arrayBuffer, options = {}) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error('Expected binary .onepkg payload as ArrayBuffer');
  }

  const parsed = parseCabEntries(arrayBuffer);
  const notebookName = baseNameFromFile(options.fileName || 'Notebook.onepkg');
  const notebookFolder = toFolderSafeName(notebookName);

  const hierarchy = {
    kind: 'notebook',
    name: notebookName,
    path: `${notebookFolder}/`,
    children: []
  };

  for (const entry of parsed.entries) {
    insertPathNode(hierarchy, entry.name);
  }

  return {
    sourceKind: 'onepkg',
    hierarchy,
    pages: [],
    warnings: [
      `Parsed CAB container with ${parsed.entryCount} entries.`,
      '.onepkg page extraction is scaffolded but not yet implemented.'
    ],
    archiveEntries: parsed.entries
  };
}