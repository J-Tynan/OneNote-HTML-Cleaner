import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const cleanedDir = path.resolve(process.cwd(), 'Tests', 'Cleaned');
const outPath = path.resolve(process.cwd(), 'Tests', 'reports', 'manual-review-summary.md');

function walkHtmlFiles(dirPath) {
  const out = [];
  if (!fs.existsSync(dirPath)) return out;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) out.push(...walkHtmlFiles(fullPath));
    else if (entry.isFile() && /\.html?$/i.test(entry.name)) out.push(fullPath);
  }
  return out;
}

function summarize(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const counts = {
    main: doc.querySelectorAll('main').length,
    h1: doc.querySelectorAll('h1').length,
    headings: doc.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
    ul: doc.querySelectorAll('ul').length,
    ol: doc.querySelectorAll('ol').length,
    li: doc.querySelectorAll('li').length,
    table: doc.querySelectorAll('table').length,
    tr: doc.querySelectorAll('tr').length,
    td: doc.querySelectorAll('td').length,
    pre: doc.querySelectorAll('pre').length,
    img: doc.querySelectorAll('img').length,
    links: doc.querySelectorAll('a[href]').length,
  };

  const firstTitle = (doc.querySelector('title')?.textContent || '').trim();
  const firstH1 = (doc.querySelector('h1')?.textContent || '').trim();

  return {
    file: path.basename(filePath),
    title: firstTitle,
    h1: firstH1,
    counts,
  };
}

function render(results) {
  const lines = [];
  lines.push('# Manual Review Summary');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| File | Title | H1 | main | headings | ul/ol/li | table/tr/td | pre | img | links |');
  lines.push('|---|---|---|---:|---:|---:|---:|---:|---:|---:|');

  for (const item of results) {
    const esc = (value) => String(value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    lines.push(
      `| ${esc(item.file)} | ${esc(item.title)} | ${esc(item.h1)} | ${item.counts.main} | ${item.counts.headings} | ${item.counts.ul + item.counts.ol}/${item.counts.li} | ${item.counts.table}/${item.counts.tr}/${item.counts.td} | ${item.counts.pre} | ${item.counts.img} | ${item.counts.links} |`
    );
  }

  lines.push('');
  lines.push('## Notes');
  lines.push('- This report is for manual-review triage; it does not replace visual inspection.');
  lines.push('- High table counts can be intentional for OneNote templates and are not auto-failed.');
  lines.push('- Contrast issues should be tracked separately in the pre-block contrast task.');
  lines.push('');

  return lines.join('\n');
}

const files = walkHtmlFiles(cleanedDir);
if (!files.length) {
  console.error(`No HTML files found in ${cleanedDir}`);
  process.exit(1);
}

const results = files.map(summarize);
const markdown = render(results);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, markdown, 'utf8');
console.log(`wrote ${outPath}`);
