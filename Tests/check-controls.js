import fs from 'fs';
import { parseMht } from '../src/pipeline/mht.js';
const raw = fs.readFileSync('Tests/Resolve merge conflicts.mht','latin1');
for (const opts of [{EnableCharsetFallback:true,EnableMapping:false},{EnableCharsetFallback:true,EnableMapping:true}]){
  const p = parseMht(raw, opts);
  console.log('opts', opts);
  console.log('  control count', p.controlCharDiagnostics ? p.controlCharDiagnostics.count : 0);
  const html = p.html || '';
  console.log('  html slice', html.slice(5200,5310).replace(/\u0014/g,'[14]').replace(/\u0019/g,'[19]'));
  if (p.controlCharDiagnostics && p.controlCharDiagnostics.samples.length) {
    p.controlCharDiagnostics.samples.forEach(s => {
      const idx = s.index;
      const context = html.slice(idx-5, idx+5);
      const codes = Array.from(context).map(ch=>ch.charCodeAt(0).toString(16).padStart(2,'0'));
      console.log('   sample at', idx, 'char', html[idx], 'codes', codes.join(' '));
    });
  }
}
