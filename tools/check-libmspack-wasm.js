const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'assets', 'wasm');
const files = ['libmspack-core.js', 'libmspack-core.wasm'];

let ok = true;
console.log('Checking libmspack WASM artifacts in', out);
for (const f of files) {
  const p = path.join(out, f);
  try {
    const stat = fs.statSync(p);
    console.log(` - ${f}: ${stat.size} bytes`);
    if (stat.size === 0) {
      console.error(`   ERROR: ${f} has zero size`);
      ok = false;
    }
  } catch (e) {
    console.error(`   MISSING: ${f}`);
    ok = false;
  }
}
if (!ok) {
  console.error('\nSmoke check failed. Run `npm run build:libmspack:wasm` and inspect output.');
  process.exit(2);
}
console.log('\nSmoke check OK.');
process.exit(0);
