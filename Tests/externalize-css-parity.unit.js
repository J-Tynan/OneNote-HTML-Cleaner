import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { FIXTURE_FILES, readFixture } from './fixtures.js';

if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
  global.NodeFilter = dom.window.NodeFilter;
}

const { parseMht } = await import('../src/pipeline/mht.js');
const { runPipeline } = await import('../src/pipeline/pipeline.js');
const { setEnabled } = await import('../src/logging.js');
setEnabled(false);

const REPRESENTATIVE_FIXTURES = [
  FIXTURE_FILES.COMMUNICATE_MARKDOWN,
  FIXTURE_FILES.DEVTOOLS,
  FIXTURE_FILES.RESOLVE_MERGE_CONFLICTS,
  FIXTURE_FILES.TEST_FILE
];

function parseHtml(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function removeWhitespaceTextNodes(root) {
  const walker = root.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const toRemove = [];
  let node = walker.nextNode();
  while (node) {
    if (!node.nodeValue || /^\s+$/.test(node.nodeValue)) {
      toRemove.push(node);
    }
    node = walker.nextNode();
  }
  toRemove.forEach((entry) => entry.parentNode && entry.parentNode.removeChild(entry));
}

function canonicalizeForParity(html) {
  const doc = parseHtml(html);
  Array.from(doc.querySelectorAll('style, link[rel="stylesheet"]')).forEach((node) => node.remove());
  Array.from(doc.querySelectorAll('[style], [class]')).forEach((el) => {
    el.removeAttribute('style');
    el.removeAttribute('class');
  });
  removeWhitespaceTextNodes(doc);
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

function collectStructureStats(doc) {
  const selectors = ['main', 'h1', 'h2', 'h3', 'p', 'img', 'table', 'ul', 'ol', 'li', 'a', 'pre', 'code'];
  const stats = {};
  selectors.forEach((selector) => {
    stats[selector] = doc.querySelectorAll(selector).length;
  });
  stats.dataImages = doc.querySelectorAll('img[src^="data:image/"]').length;
  stats.title = (doc.querySelector('title') && doc.querySelector('title').textContent || '').trim();
  stats.mainText = (doc.querySelector('main') && doc.querySelector('main').textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
  return stats;
}

function getExtcssClassNames(doc) {
  const names = new Set();
  Array.from(doc.querySelectorAll('[class]')).forEach((el) => {
    String(el.getAttribute('class') || '')
      .split(/\s+/)
      .filter(Boolean)
      .filter((name) => name.startsWith('extcss-'))
      .forEach((name) => names.add(name));
  });
  return Array.from(names).sort();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function convertFixture(fileName, config) {
  const raw = readFixture(fileName, 'latin1');
  const parsed = parseMht(raw, { EnableCharsetFallback: true, EnableMapping: true });
  return runPipeline(parsed.html || '', {
    EnableCharsetFallback: true,
    InjectTailwindCss: false,
    imageMap: parsed.imageMap || {},
    ...config
  });
}

console.log('running externalized CSS parity regression tests');

for (const fixture of REPRESENTATIVE_FIXTURES) {
  const embedded = await convertFixture(fixture, {
    ExternalizeCssEnabled: false
  });
  const shared = await convertFixture(fixture, {
    ExternalizeCssEnabled: true,
    ExternalizeCssMode: 'shared'
  });
  const perPage = await convertFixture(fixture, {
    ExternalizeCssEnabled: true,
    ExternalizeCssMode: 'per-page'
  });

  const embeddedDoc = parseHtml(embedded.output || '');
  const sharedDoc = parseHtml(shared.output || '');
  const perPageDoc = parseHtml(perPage.output || '');

  const embeddedSignature = canonicalizeForParity(embedded.output || '');
  const sharedSignature = canonicalizeForParity(shared.output || '');
  const perPageSignature = canonicalizeForParity(perPage.output || '');

  assert.equal(sharedSignature, embeddedSignature, `${fixture}: shared externalized output should preserve semantic structure`);
  assert.equal(perPageSignature, embeddedSignature, `${fixture}: per-page externalized output should preserve semantic structure`);

  assert.deepEqual(
    collectStructureStats(sharedDoc),
    collectStructureStats(embeddedDoc),
    `${fixture}: shared externalized output should preserve key structural counts`
  );
  assert.deepEqual(
    collectStructureStats(perPageDoc),
    collectStructureStats(embeddedDoc),
    `${fixture}: per-page externalized output should preserve key structural counts`
  );

  assert(shared.assets && shared.assets.length === 1, `${fixture}: shared mode should emit one CSS asset`);
  assert(perPage.assets && perPage.assets.length === 1, `${fixture}: per-page mode should emit one CSS asset`);
  assert.equal(shared.assets[0].type, 'text/css', `${fixture}: shared asset should be CSS`);
  assert.equal(perPage.assets[0].type, 'text/css', `${fixture}: per-page asset should be CSS`);
  assert.equal(shared.assets[0].filename, 'converted-shared.css', `${fixture}: shared mode should use shared CSS filename`);
  assert.equal(perPage.assets[0].filename, 'converted-page.css', `${fixture}: per-page mode should use per-page CSS filename contract`);
  assert(shared.assets[0].content.trim().length > 0, `${fixture}: shared CSS asset should not be empty`);
  assert.equal(
    shared.assets[0].content,
    perPage.assets[0].content,
    `${fixture}: shared and per-page modes should emit content-identical CSS`
  );

  const sharedExtcssClasses = getExtcssClassNames(sharedDoc);
  const perPageExtcssClasses = getExtcssClassNames(perPageDoc);
  assert.deepEqual(sharedExtcssClasses, perPageExtcssClasses, `${fixture}: both externalized modes should generate the same extcss class set`);
  assert(sharedExtcssClasses.length > 0, `${fixture}: externalized output should expose generated extcss classes`);

  sharedExtcssClasses.forEach((className) => {
    const rulePattern = new RegExp(`\\.${escapeRegExp(className)}\\s*\\{`);
    assert(rulePattern.test(shared.assets[0].content), `${fixture}: shared CSS asset should define ${className}`);
    assert(rulePattern.test(perPage.assets[0].content), `${fixture}: per-page CSS asset should define ${className}`);
  });

  console.log(`${fixture}: OK`);
}

console.log('externalize-css-parity: PASS');