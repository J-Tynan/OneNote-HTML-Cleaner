import fs from 'node:fs';
import path from 'node:path';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const appCssPath = path.resolve(process.cwd(), 'src/styles/tailwind-app.css');
  const exportCssPath = path.resolve(process.cwd(), 'src/styles/tailwind-export.css');
  const appCss = fs.readFileSync(appCssPath, 'utf8');
  const exportCss = fs.readFileSync(exportCssPath, 'utf8');

  if (!appCss.includes('@custom-variant dark (&:where(.dark, .dark *));')) {
    fail('src/styles/tailwind-app.css must define the class-based dark variant');
  }

  for (const [cssPath, css] of [[appCssPath, appCss], [exportCssPath, exportCss]]) {
    if (!css.includes('@import "tailwindcss/utilities.css" layer(utilities) source(none);')) {
      fail(`${path.relative(process.cwd(), cssPath)} must disable automatic source detection for explicit Tailwind v4 scanning`);
    }

    if (css.includes('preflight.css') || css.includes('@import "tailwindcss"')) {
      fail(`${path.relative(process.cwd(), cssPath)} must keep Tailwind preflight disabled`);
    }
  }

  for (const requiredSource of ['../../index.html', '../../src']) {
    if (!appCss.includes(`@source "${requiredSource}";`)) {
      fail(`src/styles/tailwind-app.css must register ${requiredSource} as a Tailwind source`);
    }
  }

  if (!exportCss.includes('@source "../../Tests/Cleaned";')) {
    fail('src/styles/tailwind-export.css must register ../../Tests/Cleaned as a Tailwind source');
  }

  console.log('tailwind-darkmode: OK');
}

main().catch((err) => {
  console.error('tailwind-darkmode failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});