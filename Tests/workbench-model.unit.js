import assert from 'node:assert/strict';
import {
  buildWorkbenchTree,
  deriveAggregateStatus,
  deriveSelectionStates,
  getLeafIdsForNode,
  getVisibleNodeIds
} from '../src/ui-workbench-model.js';

const workbench = buildWorkbenchTree([
  {
    id: 'welcome',
    name: 'Welcome.mht',
    relativePath: 'Notebook A/Section 1/Welcome.mht',
    size: 100,
    sourceKind: 'mht',
    status: 'success'
  },
  {
    id: 'notes',
    name: 'Notes.mht',
    relativePath: 'Notebook A/Section 1/Notes.mht',
    size: 200,
    sourceKind: 'mht',
    status: 'queued'
  },
  {
    id: 'error',
    name: 'Archive.mht',
    relativePath: 'Archive.mht',
    size: 50,
    sourceKind: 'mht',
    status: 'error',
    message: 'Conversion failed'
  }
]);

const byId = new Map(workbench.nodes.map((node) => [node.id, node]));
const notebook = byId.get('folder-Notebook-A');
const section = byId.get('folder-Notebook-A-Section-1');

assert.ok(notebook);
assert.ok(section);
assert.deepEqual(workbench.rootIds, ['folder-Notebook-A', 'entry-error']);
assert.equal(notebook.leafCount, 2);
assert.equal(notebook.successfulLeafCount, 1);
assert.equal(notebook.size, 300);
assert.equal(notebook.status, 'queued');
assert.deepEqual(getLeafIdsForNode(workbench.nodes, section.id), ['entry-welcome', 'entry-notes']);
assert.equal(deriveAggregateStatus(['success', 'unsupported']), 'partial');
assert.equal(deriveAggregateStatus(['success', 'error']), 'error');

const selectionStates = deriveSelectionStates(workbench.nodes, ['entry-welcome']);
assert.equal(selectionStates.get('entry-welcome'), 'checked');
assert.equal(selectionStates.get('entry-notes'), 'unchecked');
assert.equal(selectionStates.get(section.id), 'mixed');
assert.equal(selectionStates.get(notebook.id), 'mixed');

const fullSelectionStates = deriveSelectionStates(workbench.nodes, getLeafIdsForNode(workbench.nodes, notebook.id));
assert.equal(fullSelectionStates.get(notebook.id), 'checked');

const visibleNodeIds = getVisibleNodeIds(workbench.nodes, 'notes');
assert.deepEqual([...visibleNodeIds].sort(), [
  'entry-notes',
  'folder-Notebook-A',
  'folder-Notebook-A-Section-1'
]);

const errorNodeIds = getVisibleNodeIds(workbench.nodes, 'failed');
assert.deepEqual([...errorNodeIds], ['entry-error']);

console.log('workbench-model.unit: OK');