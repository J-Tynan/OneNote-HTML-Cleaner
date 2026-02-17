const path = require('node:path');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const cfgPath = path.resolve(process.cwd(), 'tailwind.config.js');
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