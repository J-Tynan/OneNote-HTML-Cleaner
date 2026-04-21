import fs from 'node:fs';
import path from 'node:path';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const cssPath = path.resolve(process.cwd(), 'src/styles/tailwind.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  if (!css.includes('@custom-variant dark (&:where(.dark, .dark *));')) {
    fail('src/styles/tailwind.css must define the class-based dark variant');
  }

  if (!css.includes('@import "tailwindcss/utilities.css" layer(utilities) source(none);')) {
    fail('src/styles/tailwind.css must disable automatic source detection for explicit Tailwind v4 scanning');
  }

  for (const requiredSource of ['../../index.html', '../../src', '../../Tests/Cleaned']) {
    if (!css.includes(`@source "${requiredSource}";`)) {
      fail(`src/styles/tailwind.css must register ${requiredSource} as a Tailwind source`);
    }
  }

  if (css.includes('preflight.css') || css.includes('@import "tailwindcss"')) {
    fail('src/styles/tailwind.css must keep Tailwind preflight disabled');
  }

  console.log('tailwind-darkmode: OK');
}

main().catch((err) => {
  console.error('tailwind-darkmode failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});