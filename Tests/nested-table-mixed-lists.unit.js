import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { setupNodeTestEnvironment } from './node-test-helper.js';

const { runPipeline } = await import('../src/pipeline/pipeline.js');

await setupNodeTestEnvironment();

console.log('running nested-table-mixed-lists unit test');

const fixturePath = path.join(process.cwd(), 'Tests', 'fixtures', 'nested-table-mixed-lists.html');

const input = fs.readFileSync(fixturePath, 'utf8');

const result = await runPipeline(input, {
  RepairListItemValues: 'smart'
});

const parser = new DOMParser();
const doc = parser.parseFromString(result.output || '', 'text/html');

const outerTables = doc.querySelectorAll('main > table');
assert.equal(outerTables.length, 1, 'expected one outer table under <main>');

const innerTables = doc.querySelectorAll('main > table > tbody > tr > td > table');
assert.equal(innerTables.length, 1, 'expected one nested inner table inside the outer table cell');

const topLevelOrderedLists = doc.querySelectorAll('main > table > tbody > tr > td > table > tbody > tr > td > ol');
assert.equal(topLevelOrderedLists.length, 1, 'expected one top-level ordered list in nested table output');

const orderedItems = Array.from(topLevelOrderedLists[0].querySelectorAll(':scope > li')).map((li) => ({
  text: li.textContent.trim(),
  value: li.getAttribute('value')
}));
assert.deepEqual(orderedItems, [
  { text: 'One', value: '1' },
  { text: 'Two', value: '2' }
]);
assert.equal(topLevelOrderedLists[0].getAttribute('type'), 'I', 'expected upper-roman ordered list type to be preserved');

const siblingUnorderedLists = doc.querySelectorAll('main > table > tbody > tr > td > table > tbody > tr > td > ul');
assert.equal(siblingUnorderedLists.length, 1, 'expected one sibling unordered list in nested table output');
assert.deepEqual(
  Array.from(siblingUnorderedLists[0].querySelectorAll(':scope > li')).map((li) => li.textContent.trim()),
  ['Alpha', 'Beta']
);

assert.equal(doc.querySelectorAll('ol ol, ul ul, ul ol, ol ul').length, 0, 'did not expect nested lists in this fixture to be flattened or introduced unexpectedly');

console.log('nested-table-mixed-lists: PASS');