// @ts-check

/**
 * @typedef {import('./contracts.js').SourceKind} SourceKind
 * @typedef {import('./contracts.js').WorkbenchNode} WorkbenchNode
 * @typedef {import('./contracts.js').WorkbenchNodeKind} WorkbenchNodeKind
 * @typedef {import('./contracts.js').WorkbenchNodeStatus} WorkbenchNodeStatus
 * @typedef {{ id?: string, name?: string, relativePath?: string, size?: number, sourceKind?: SourceKind | string, status?: string, message?: string, workbenchKind?: WorkbenchNodeKind }} WorkbenchEntry
 */

const LEAF_KINDS = new Set(['page', 'file']);

/**
 * @param {unknown} value
 * @returns {WorkbenchNodeStatus}
 */
function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status === 'working' || status === 'processing' || status === 'in-progress') return 'working';
  if (status === 'success' || status === 'completed' || status === 'done') return 'success';
  if (status === 'error' || status === 'failed') return 'error';
  if (status === 'unsupported') return 'unsupported';
  return 'queued';
}

/**
 * @param {unknown} value
 * @returns {SourceKind}
 */
function normalizeSourceKind(value) {
  const sourceKind = String(value || '').toLowerCase();
  if (sourceKind === 'html' || sourceKind === 'mht' || sourceKind === 'one' || sourceKind === 'onepkg') {
    return sourceKind;
  }
  return 'unknown';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeRelativePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function toSafeId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-');
}

/**
 * @param {WorkbenchNodeStatus[]} statuses
 * @returns {WorkbenchNodeStatus}
 */
export function deriveAggregateStatus(statuses) {
  if (statuses.length === 0) return 'queued';
  const uniqueStatuses = new Set(statuses);
  if (uniqueStatuses.size === 1) return statuses[0];
  if (uniqueStatuses.has('error')) return 'error';
  if (uniqueStatuses.has('working')) return 'working';
  if (uniqueStatuses.has('queued')) return 'queued';
  return 'partial';
}

/**
 * @param {WorkbenchEntry[]} entries
 * @returns {{ nodes: WorkbenchNode[], rootIds: string[] }}
 */
export function buildWorkbenchTree(entries) {
  /** @type {Map<string, WorkbenchNode>} */
  const nodesById = new Map();
  /** @type {string[]} */
  const rootIds = [];

  /** @param {WorkbenchNode} node */
  const addNode = (node) => {
    nodesById.set(node.id, node);
    if (node.parentId) {
      const parent = nodesById.get(node.parentId);
      if (parent) parent.childIds.push(node.id);
    } else {
      rootIds.push(node.id);
    }
  };

  entries.forEach((entry, index) => {
    const name = String(entry?.name || 'unnamed');
    const entryId = toSafeId(entry?.id) || `entry-${index + 1}`;
    const relativePath = normalizeRelativePath(entry?.relativePath) || name;
    const pathSegments = relativePath.split('/').filter(Boolean);
    const folderSegments = pathSegments.slice(0, -1);
    let parentId = null;
    let parentPath = '';

    for (const segment of folderSegments) {
      parentPath = parentPath ? `${parentPath}/${segment}` : segment;
      const folderId = `folder-${toSafeId(parentPath)}`;
      if (!nodesById.has(folderId)) {
        addNode({
          id: folderId,
          parentId,
          kind: 'folder',
          name: segment,
          relativePath: parentPath,
          sourceKind: 'unknown',
          status: 'queued',
          size: 0,
          leafCount: 0,
          successfulLeafCount: 0,
          childIds: []
        });
      }
      parentId = folderId;
    }

    const requestedKind = entry?.workbenchKind;
    const kind = requestedKind === 'page' ? 'page' : 'file';
    addNode({
      id: `entry-${entryId}`,
      parentId,
      kind,
      name,
      relativePath,
      sourceKind: normalizeSourceKind(entry?.sourceKind),
      status: normalizeStatus(entry?.status),
      size: Number.isFinite(entry?.size) ? Math.max(0, Number(entry.size)) : 0,
      leafCount: 1,
      successfulLeafCount: normalizeStatus(entry?.status) === 'success' ? 1 : 0,
      childIds: [],
      message: typeof entry?.message === 'string' && entry.message ? entry.message : undefined
    });
  });

  const nodes = Array.from(nodesById.values());
  for (const node of [...nodes].reverse()) {
    if (LEAF_KINDS.has(node.kind)) continue;
    /** @type {WorkbenchNode[]} */
    const children = [];
    for (const childId of node.childIds) {
      const child = nodesById.get(childId);
      if (child) children.push(child);
    }
    node.size = children.reduce((total, child) => total + child.size, 0);
    node.leafCount = children.reduce((total, child) => total + child.leafCount, 0);
    node.successfulLeafCount = children.reduce((total, child) => total + child.successfulLeafCount, 0);
    node.status = deriveAggregateStatus(children.map((child) => child.status));
  }

  return { nodes, rootIds };
}

/**
 * @param {WorkbenchNode[]} nodes
 * @param {string} nodeId
 * @returns {string[]}
 */
export function getLeafIdsForNode(nodes, nodeId) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const node = nodesById.get(nodeId);
  if (!node) return [];
  if (LEAF_KINDS.has(node.kind)) return [node.id];

  /** @type {string[]} */
  const leafIds = [];
  /** @param {WorkbenchNode} current */
  const visit = (current) => {
    for (const childId of current.childIds) {
      const child = nodesById.get(childId);
      if (!child) continue;
      if (LEAF_KINDS.has(child.kind)) leafIds.push(child.id);
      else visit(child);
    }
  };
  visit(node);
  return leafIds;
}

/**
 * @param {WorkbenchNode[]} nodes
 * @param {Iterable<string>} selectedLeafIds
 * @returns {Map<string, 'checked' | 'mixed' | 'unchecked'>}
 */
export function deriveSelectionStates(nodes, selectedLeafIds) {
  const selected = new Set(selectedLeafIds);
  return new Map(nodes.map((node) => {
    const leafIds = getLeafIdsForNode(nodes, node.id);
    const selectedCount = leafIds.filter((leafId) => selected.has(leafId)).length;
    const state = selectedCount === 0
      ? 'unchecked'
      : (selectedCount === leafIds.length ? 'checked' : 'mixed');
    return [node.id, state];
  }));
}

/**
 * @param {WorkbenchNode[]} nodes
 * @param {string} query
 * @returns {Set<string>}
 */
export function getVisibleNodeIds(nodes, query) {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
  if (!normalizedQuery) return new Set(nodes.map((node) => node.id));

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const visible = new Set();
  for (const node of nodes) {
    const haystack = `${node.name} ${node.relativePath} ${node.status} ${node.message || ''}`.toLocaleLowerCase();
    if (!haystack.includes(normalizedQuery)) continue;
    visible.add(node.id);
    let parentId = node.parentId;
    while (parentId) {
      visible.add(parentId);
      parentId = nodesById.get(parentId)?.parentId || null;
    }
  }
  return visible;
}