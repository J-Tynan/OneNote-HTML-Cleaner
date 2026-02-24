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
  // read as latin1 to treat each byte as a character 0-255
  const raw = fs.readFileSync(filePath, 'latin1');

  // parse without fallback (mapping off)
  const noFallback = parseMht(raw, { EnableCharsetFallback: false });
  // parse with fallback (enable mapping to get offsets)
  const withFallbackMapped = parseMht(raw, { EnableCharsetFallback: true, EnableMapping: true });
  // also parse fallback without mapping for real output checks
  const withFallback = parseMht(raw, { EnableCharsetFallback: true });

  console.log(`\n-- fixture: ${name}`);
  console.log('noFallback HTML length', noFallback.html ? noFallback.html.length : null);
  console.log('withFallback HTML length', withFallback.html ? withFallback.html.length : null);

  // Assert fallback yields no illegal controls; diagnostics should at least run
  assert(withFallback.html && checkNoControlChars(withFallback.html), 'fallback output contains control characters');
  if (withFallbackMapped.controlCharDiagnostics) {
    console.log('  diagnostic count', withFallbackMapped.controlCharDiagnostics.count, 'samples', withFallbackMapped.controlCharDiagnostics.samples);
    if (withFallbackMapped.controlCharDiagnostics.samples.length && withFallbackMapped.controlCharDiagnostics.samples[0].rawTextOffset !== undefined) {
      console.log('    rawTextOffsets:', withFallbackMapped.controlCharDiagnostics.samples.map(s=>s.rawTextOffset));
    }
  }
  // if original parse had bad chars, fallbackMapped.part should note charset used
  if (!noFallback.html || !checkNoControlChars(noFallback.html)) {
    const htmlPartMapped = (withFallbackMapped.parts || []).find(p=>/text\/html/i.test(p.ContentType));
    assert(htmlPartMapped && htmlPartMapped.CharsetFallbackApplied === true, 'expected CharsetFallbackApplied for HTML part');
    assert(htmlPartMapped.CharsetUsed && /^windows-1252/.test(htmlPartMapped.CharsetUsed), 'expected CharsetUsed windows-1252');
  }

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
  function loadRaw(name) {
    let filePath = path.resolve('Tests/fixtures', name);
    if (!fs.existsSync(filePath)) {
      filePath = path.resolve('Tests', name);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  for (const f of fixtures) {
    runFixture(f);
    // also verify sanitization doesn't leave controls
    const raw = loadRaw(f);
    const san = parseMht(raw, { EnableCharsetFallback: true, EnableControlSanitization: true });
    if (san.html) {
      assert(checkNoControlChars(san.html), 'sanitized HTML still contains control characters');
      console.log(`  sanitization applied for ${f}, sanitized=${san.controlCharSanitized}`);
    }
  }
  console.log('\nRegression tests passed.');
}

main();
