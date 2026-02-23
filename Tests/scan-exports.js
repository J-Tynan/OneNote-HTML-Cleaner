import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dir = path.join(__dirname, 'exports-from-mht');
if (!fs.existsSync(dir)) {
  console.log('No exports directory at', dir);
  process.exit(0);
}
let found = false;
for (const f of fs.readdirSync(dir).filter(x => x.match(/\.html?$/i))) {
  const p = path.join(dir, f);
  const s = fs.readFileSync(p, 'utf8');
  // ignore common whitespace: TAB (09), LF (0A), CR (0D)
  const re = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]/g;
  let m;
  while ((m = re.exec(s))) {
    found = true;
    const cp = m[0].codePointAt(0).toString(16).toUpperCase();
    const idx = m.index;
    const start = Math.max(0, idx - 40);
    const snippet = s.slice(start, Math.min(s.length, idx + 40)).replace(/\r?\n/g, '\u2424');
    console.log(`${f} | U+${cp} at ${idx} -> ...${snippet}...`);
  }
}
if (!found) console.log('No control/replacement chars found in exports');
