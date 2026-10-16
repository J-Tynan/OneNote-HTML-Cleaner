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

const nativeWorkbench = buildWorkbenchTree([{
  id: 'native-notebook',
  name: 'Test Notebook.onepkg',
  sourceKind: 'onepkg',
  status: 'success',
  nativeResult: {
    sourceKind: 'onepkg',
    state: 'partial',
    pages: [
      { name: 'Welcome', path: 'Test Notebook/Section 1/Welcome.html', html: '<main>Welcome</main>' },
      { name: 'Project Plan', path: 'Test Notebook/Section 1/Project Plan.html', html: '<main>Plan</main>' }
    ],
    hierarchy: {
      kind: 'notebook',
      name: 'Test Notebook',
      path: 'Test Notebook/',
      children: [{
        kind: 'section',
        name: 'Section 1',
        path: 'Test Notebook/Section 1/',
        children: [
          { kind: 'page', name: 'Welcome', path: 'Test Notebook/Section 1/Welcome.html' },
          { kind: 'page', name: 'Project Plan', path: 'Test Notebook/Section 1/Project Plan.html' }
        ]
      }]
    },
    warnings: ['One page needs review.']
  }
}]);

const nativeById = new Map(nativeWorkbench.nodes.map((node) => [node.id, node]));
const nativeNotebook = nativeWorkbench.nodes.find((node) => node.kind === 'notebook');
const nativeSection = nativeWorkbench.nodes.find((node) => node.kind === 'section');
const nativeWelcome = nativeWorkbench.nodes.find((node) => node.name === 'Welcome');

assert.ok(nativeNotebook);
assert.ok(nativeSection);
assert.ok(nativeWelcome);
assert.equal(nativeNotebook.status, 'partial');
assert.equal(nativeNotebook.leafCount, 2);
assert.equal(nativeSection.successfulLeafCount, 0);
assert.equal(nativeWelcome.queueEntryId, 'native-notebook');
assert.equal(nativeWelcome.nativePagePath, 'Test Notebook/Section 1/Welcome.html');
assert.equal(nativeWelcome.size, '<main>Welcome</main>'.length);
assert.deepEqual(getLeafIdsForNode(nativeWorkbench.nodes, nativeNotebook.id), nativeSection.childIds);
assert.deepEqual([...getVisibleNodeIds(nativeWorkbench.nodes, 'project').values()].sort(), [
  nativeNotebook.id,
  nativeSection.id,
  nativeById.get(nativeSection.childIds[1]).id
].sort());

console.log('workbench-model.unit: OK');