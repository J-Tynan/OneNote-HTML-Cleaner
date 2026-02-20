#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: node scripts/bump-sw-cache.cjs --set=<name> | --increment [--file=<path>] [--yes]');
  process.exit(2);
}

const argv = process.argv.slice(2);
let setName = null;
let doIncrement = false;
let filePath = path.join(process.cwd(), 'service-worker.js');
let yes = false;

for (const a of argv) {
  if (a.startsWith('--set=')) setName = a.split('=')[1];
  else if (a === '--increment' || a === '-i') doIncrement = true;
  else if (a.startsWith('--file=')) filePath = path.resolve(a.split('=')[1]);
  else if (a === '--yes' || a === '-y') yes = true;
  else usage();
}

if (!setName && !doIncrement) usage();
if (!fs.existsSync(filePath)) {
  console.error('service worker file not found:', filePath);
  process.exit(3);
}

const src = fs.readFileSync(filePath, 'utf8');
// Find the fallback cache name in the CACHE declaration
const match = src.match(/const\s+CACHE\s*=([\s\S]*?):\s*'([^']+)'/);
if (!match) {
  console.error('failed to locate fallback cache name in', filePath);
  process.exit(4);
}
const currentName = match[2];
let newName = setName || currentName;

if (doIncrement) {
  const m = currentName.match(/(.*v)(\d+)$/);
  if (m) {
    newName = m[1] + String(Number(m[2]) + 1);
  } else {
    // fallback: append -v2
    newName = currentName + '-v2';
  }
}

if (newName === currentName) {
  console.log('cache name unchanged:', currentName);
  process.exit(0);
}

if (!yes) {
  console.log(`Update cache name: "${currentName}" -> "${newName}"`);
  console.log('Rerun with --yes to apply.');
  process.exit(0);
}

const replaced = src.replace(new RegExp("(')" + currentName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + "(')"), `$1${newName}$2`);
fs.writeFileSync(filePath, replaced, 'utf8');
console.log(`service worker cache name updated: ${currentName} -> ${newName} in ${filePath}`);
process.exit(0);
