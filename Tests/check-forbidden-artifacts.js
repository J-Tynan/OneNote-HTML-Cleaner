import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';

const THIS_FILE = path.resolve(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    dir: path.join('Tests', 'Cleaned')
  };

  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--dir' && argv[i + 1]) {
      args.dir = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function walkHtmlFiles(dirPath) {
  const out = [];
  if (!fs.existsSync(dirPath)) return out;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkHtmlFiles(fullPath));
    } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
      out.push(fullPath);
    }
  }
  return out;
}

function shortNodePath(node) {
  const parts = [];
  let current = node;
  let depth = 0;

  while (current && current.nodeType === 1 && depth < 5) {
    const id = current.getAttribute('id');
    const cls = (current.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
    const suffix = id ? `#${id}` : cls ? `.${cls}` : '';
    parts.unshift(`${current.tagName.toLowerCase()}${suffix}`);
    current = current.parentElement;
    depth += 1;
  }

  return parts.join(' > ');
}

export function analyzeHtml(filePath, html) {
  const violations = [];
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const deprecatedTags = new Set(['font', 'center', 'strike']);
  const deprecatedAttrs = new Set(['bgcolor', 'align', 'border', 'summary']);
  const bannedXmlnsAttrs = new Set(['xmlns:o', 'xmlns:v', 'xmlns:w']);
  const officeNsRe = /^https?:\/\/schemas\.microsoft\.com\/(office|onenote|word)/i;
  const officeClassTokenRe = /^(mso\w*|wordsection\d*)$/i;
  const officeStyleDeclRe = /(^|[;\s])(mso-[a-z-]+|tab-stops|layout-grid(?:-mode|-line|-char)?|mso-element|mso-pagination)\s*:/i;

  const allElements = Array.from(doc.querySelectorAll('*'));

  for (const el of allElements) {
    const tag = el.tagName.toLowerCase();
    if (deprecatedTags.has(tag)) {
      violations.push({
        type: 'deprecated-element',
        token: `<${tag}>`,
        where: shortNodePath(el)
      });
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '');

      if (name.startsWith('mso-')) {
        violations.push({
          type: 'office-attribute',
          token: attr.name,
          where: shortNodePath(el)
        });
      }

      if (bannedXmlnsAttrs.has(name)) {
        violations.push({
          type: 'office-namespace',
          token: attr.name,
          where: shortNodePath(el)
        });
      }

      if (name === 'xmlns' && officeNsRe.test(value)) {
        violations.push({
          type: 'office-namespace-uri',
          token: `xmlns=\"${value}\"`,
          where: shortNodePath(el)
        });
      }

      if (deprecatedAttrs.has(name)) {
        violations.push({
          type: 'deprecated-attribute',
          token: attr.name,
          where: shortNodePath(el)
        });
      }

      // optional hardening: catch namespace-prefixed attrs commonly emitted by Office
      if (/^(o|v|w):/i.test(name)) {
        violations.push({
          type: 'office-prefixed-attribute',
          token: attr.name,
          where: shortNodePath(el)
        });
      }

      // retain existing mso artifact protection used elsewhere in the repo
      if (name === 'style' && officeStyleDeclRe.test(value)) {
        violations.push({
          type: 'office-style-declaration',
          token: 'style contains office-specific declarations',
          where: shortNodePath(el)
        });
      }

      if (name === 'class') {
        const tokens = value.trim().split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          if (!officeClassTokenRe.test(token)) continue;
          violations.push({
            type: 'office-class-token',
            token,
            where: shortNodePath(el)
          });
        }
      }
    }
  }

  if (/<!--\s*\[if\s+(?:gte\s+)?mso\b/i.test(html)) {
    violations.push({
      type: 'office-conditional-comment',
      token: 'MSO conditional comment',
      where: 'document'
    });
  }

  if (/xmlns\s*=\s*"http:\/\/www\.w3\.org\/TR\/REC-html40"/i.test(html)) {
    violations.push({
      type: 'legacy-html40-namespace',
      token: 'xmlns="http://www.w3.org/TR/REC-html40"',
      where: 'html'
    });
  }

  if (/meta\s+http-equiv\s*=\s*"content-type"/i.test(html)) {
    violations.push({
      type: 'redundant-content-type-meta',
      token: 'meta http-equiv="Content-Type"',
      where: 'head'
    });
  }

  if (violations.length === 0) {
    return { filePath, ok: true, violations: [] };
  }

  return { filePath, ok: false, violations };
}

function rel(filePath) {
  return filePath.split(path.sep).join('/');
}

function run() {
  const args = parseArgs(process.argv);
  const targetDir = path.resolve(process.cwd(), args.dir);

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    console.error(`directory not found: ${rel(targetDir)}`);
    process.exit(1);
  }

  const htmlFiles = walkHtmlFiles(targetDir);
  if (htmlFiles.length === 0) {
    console.error(`no html files found in ${rel(targetDir)}`);
    process.exit(1);
  }

  let failed = false;
  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const result = analyzeHtml(filePath, html);
    if (result.ok) {
      console.log(`${path.basename(filePath)}: OK`);
      continue;
    }

    failed = true;
    console.log(`${path.basename(filePath)}: FAIL (${result.violations.length} violations)`);
    for (const violation of result.violations) {
      console.log(`  - [${violation.type}] ${violation.token} at ${violation.where}`);
    }
  }

  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === THIS_FILE) {
  run();
}
