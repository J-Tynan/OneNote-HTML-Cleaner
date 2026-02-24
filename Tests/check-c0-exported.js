import fs from 'node:fs';
import path from 'node:path';

// Scan exported HTML fixtures for disallowed C0 control characters
// (U+0000..U+001F except TAB/CR/LF). Any match causes failure.

// By default we only verify the sanitized outputs that users would download.
// The legacy `exports-from-mht` directory contains earlier unnormalized files
// which are allowed to contain control codes; they are not part of the CI
// contract.
const dirs = [
  path.join('Tests', 'Cleaned'),
];
const forbidden = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

let overallFail = false;
for (const dir of dirs) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
  const files = fs.readdirSync(dir).filter(f => f.match(/\.html?$/i));
  for (const file of files) {
    const full = path.join(dir, file);
    const html = fs.readFileSync(full, 'utf8');
    const m = forbidden.exec(html);
    if (m) {
      overallFail = true;
      const idx = m.index;
      const snippet = html
        .slice(Math.max(0, idx - 5), idx + 5)
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
      console.log(
        `${dir}/${file}: forbidden C0 at index ${idx} snippet="${snippet}"`
      );
    } else {
      console.log(`${dir}/${file}: OK`);
    }
  }
}

process.exit(overallFail ? 1 : 0);
