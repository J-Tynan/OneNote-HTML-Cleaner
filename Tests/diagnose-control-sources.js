// Tests/diagnose-control-sources.js
// Diagnostic runner: record where control characters originate in the raw MHT

import fs from 'fs';
import path from 'path';
import assert from 'assert';
const { parseMht } = await import('../src/pipeline/mht.js');

async function main() {
  const fixtures = [
    'Resolve merge conflicts.mht',
    'Test File.mht',
    'Communicate using Markdown.mht',
    'DevToys.mht'
  ];

  const results = [];

  function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const diagnosticsDir = path.resolve('Tests', 'diagnostics');
  ensureDir(diagnosticsDir);

  for (const name of fixtures) {
    let filePath = path.resolve('Tests/fixtures', name);
    if (!fs.existsSync(filePath)) {
      filePath = path.resolve('Tests', name);
    }
    if (!fs.existsSync(filePath)) {
      console.warn('fixture not found', name);
      continue;
    }
    const raw = fs.readFileSync(filePath, 'latin1');

    for (const mode of [{fallback:false},{fallback:true}]) {
      const parsed = parseMht(raw, { EnableCharsetFallback: mode.fallback, EnableMapping: true });
      const kind = mode.fallback ? 'withFallback' : 'noFallback';
      if (parsed.controlCharDiagnostics && parsed.controlCharDiagnostics.samples.length) {
        // locate html part for metadata
        const htmlPart = parsed.parts.find(p => /text\/html/i.test(p.ContentType));
        for (const sample of parsed.controlCharDiagnostics.samples) {
          const offset = sample.rawTextOffset;
          const start = Math.max(0, offset - 40);
          const snippet = raw.slice(start, offset + 40);
          let hex = null;
          try {
            const enc = new TextEncoder().encode(raw);
            const slice = enc.slice(start, offset + 40);
            hex = Array.from(slice).map(b=>b.toString(16).padStart(2,'0')).join(' ');
          } catch {}
          results.push({
            fixture: name,
            mode: kind,
            partIndex: htmlPart ? htmlPart.index : null,
            contentType: htmlPart ? htmlPart.ContentType : null,
            cte: htmlPart ? htmlPart.ContentTransferEncoding : null,
            bodyRawStart: htmlPart ? htmlPart.BodyRawStart : null,
            declaredCharset: htmlPart ? htmlPart.DeclaredCharset : null,
            charsetUsed: htmlPart ? htmlPart.CharsetUsed : null,
            charsetFallback: htmlPart ? htmlPart.CharsetFallbackApplied : null,
            sample,
            rawSnippet: snippet,
            rawHex: hex
          });
        }
      }
    }
  }

  const outName = `control-sources-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const outPath = path.join(diagnosticsDir, outName);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('wrote diagnostics to', outPath);
  console.log('summary entries:', results.length);
  results.forEach(r => {
    console.log(`- ${r.fixture} ${r.mode} sample at ${r.sample.rawTextOffset} codepoint ${r.sample.codepoint}`);
  });
}

main().catch(err=>{console.error(err); process.exit(1);});
