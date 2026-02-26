import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { parseMht } from '../src/pipeline/mht.js';

// fixtures exercise various charset scenarios
const fixtures = [
  {
    name: 'resolve-merge-conflicts',
    path: path.join('Tests', 'Resolve merge conflicts.mht'),
    description: 'real-world file with ambiguous/missing charset',
    // the pipeline previously decoded this without error; we just check for an html tag
    expectedSubstring: '<html',
    requiresFallback: false,
  },
  {
    name: 'test-file-utf8',
    path: path.join('Tests', 'Test File.mht'),
    description: 'known UTF-8 MHT fixture',
    expectedSubstring: '<html',
    requiresFallback: false,
  },
  {
    name: 'inline-cp1252',
    // artificial sample / in-memory string; contains CP1252 smart quotes
    raw: `From: sample
MIME-Version: 1.0
Content-Type: multipart/related; boundary="b"

--b
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

<p>=93Hello=94 =96 world</p>
--b--`,
    description: 'minimal MHT that needs windows-1252 fallback (quotes and dash)',
    expectedSubstring: '“Hello” – world',
    requiresFallback: true,
  },
];

const optionSets = [
  { EnableCharsetFallback: false, EnableMapping: false },
  { EnableCharsetFallback: true, EnableMapping: false },
  { EnableCharsetFallback: true, EnableMapping: true },
];

let overallFail = false;

for (const fx of fixtures) {
  console.log(`\n=== fixture: ${fx.name} (${fx.description}) ===`);
  let raw;
  if (fx.path) {
    assert(fs.existsSync(fx.path), `fixture file not found: ${fx.path}`);
    raw = fs.readFileSync(fx.path, 'latin1');
  } else {
    raw = fx.raw;
  }

  for (const opts of optionSets) {
    const label = `fallback=${opts.EnableCharsetFallback} mapping=${opts.EnableMapping}`;
    let p;
    try {
      p = parseMht(raw, opts);
    } catch (e) {
      console.error(`${fx.name} ${label}: parseMht threw`, e);
      overallFail = true;
      continue;
    }
    if (!p || typeof p.html !== 'string') {
      console.error(`${fx.name} ${label}: no html output`);
      overallFail = true;
      continue;
    }

    // basic sanity
    try {
      assert(!p.html.includes('\ufffd'), 'contains replacement character');
    } catch (e) {
      if (fx.requiresFallback && !opts.EnableCharsetFallback) {
        // expected when fallback is disabled
      } else {
        console.error(`${fx.name} ${label}: ${e.message}`);
        overallFail = true;
      }
    }

    if (fx.expectedSubstring) {
      const has = p.html.includes(fx.expectedSubstring);
      if (fx.requiresFallback && !opts.EnableCharsetFallback) {
        if (has) {
          console.error(`${fx.name} ${label}: unexpectedly contained expected substring without fallback`);
          overallFail = true;
        }
      } else {
        if (!has) {
          console.error(`${fx.name} ${label}: missing expected substring in output`);
          overallFail = true;
        }
      }
    }

    if (opts.EnableMapping) {
      const hasMapping = p.parts && p.parts.some(pt => pt.BodyDecodedMapping);
      if (!hasMapping) {
        console.error(`${fx.name} ${label}: missing BodyDecodedMapping`);
        overallFail = true;
      }
    }

    console.log(`${fx.name} ${label}: OK`);
  }
}

if (overallFail) {
  console.error('\ncharset-regression test: FAIL');
  process.exit(1);
} else {
  console.log('\ncharset-regression test: PASS');
  process.exit(0);
}
