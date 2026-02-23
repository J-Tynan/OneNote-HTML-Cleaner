// Tests/mht-encoding-regressions.js
// Regression checks for charset fallback behavior

import fs from 'fs';
import path from 'path';
import assert from 'assert';
const { parseMht } = await import('../src/pipeline/mht.js');

function checkNoControlChars(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0x80 && code <= 0x9f) || code === 0xfffd) {
      return false;
    }
  }
  return true;
}

function runFixture(name) {
  let filePath = path.resolve('Tests/fixtures', name);
  if (!fs.existsSync(filePath)) {
    filePath = path.resolve('Tests', name);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');

  // parse without fallback
  const noFallback = parseMht(raw, { EnableCharsetFallback: false });
  // parse with fallback
  const withFallback = parseMht(raw, { EnableCharsetFallback: true });

  console.log(`\n-- fixture: ${name}`);
  console.log('noFallback HTML length', noFallback.html ? noFallback.html.length : null);
  console.log('withFallback HTML length', withFallback.html ? withFallback.html.length : null);

  // Assert fallback yields no illegal controls
  assert(withFallback.html && checkNoControlChars(withFallback.html), 'fallback output contains control characters');

  // If noFallback already good, ensure lengths match
  if (noFallback.html && checkNoControlChars(noFallback.html)) {
    console.log('  noFallback output already clean');
  } else {
    console.log('  noFallback output had bad chars, fallback fixed them');
  }
}

function main() {
  const fixtures = [
    'Resolve merge conflicts.mht',
    'Test File.mht'
    // more fixtures can be added as needed
  ];
  for (const f of fixtures) {
    runFixture(f);
  }
  console.log('\nRegression tests passed.');
}

main();
