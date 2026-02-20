import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const cfgPath = (function(){
    const cjs = path.resolve(process.cwd(), 'tailwind.config.cjs');
    return fs.existsSync(cjs) ? cjs : path.resolve(process.cwd(), 'tailwind.config.js');
  })();
  const cfg = require(cfgPath);
  if (!cfg || cfg.darkMode !== 'class') {
    fail('tailwind.config.js must set darkMode: "class"');
  }
  console.log('tailwind-darkmode: OK');
}

main().catch((err) => {
  console.error('tailwind-darkmode failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});