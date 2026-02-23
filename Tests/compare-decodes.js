import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { pathToFileURL } from 'node:url';
const src = path.join(__dirname, '..', 'src', 'pipeline', 'mht.js');
if (!fs.existsSync(src)) { console.error('mht parser not found at', src); process.exit(1); }
const mhtModule = await import(pathToFileURL(src).href);
const parseMht = mhtModule.parseMht;
if (typeof parseMht !== 'function') { console.error('parseMht not exported'); process.exit(1); }

// enable detailed per-part charset logging for debugging
globalThis.MHT_CHARSET_LOG = true;

const mhtDir = path.join(__dirname);
const mhtFiles = fs.readdirSync(mhtDir).filter(f => f.toLowerCase().endsWith('.mht') || f.toLowerCase().endsWith('.mhtml'));
if (mhtFiles.length === 0) { console.log('No MHT fixtures found in Tests/ -- nothing to compare'); process.exit(0); }

function findControls(s){
  const re = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]/g;
  const out = [];
  let m;
  while((m=re.exec(s))){
    out.push({idx:m.index,cp:m[0].codePointAt(0).toString(16).toUpperCase(),snippet:s.slice(Math.max(0,m.index-40),m.index+40).replace(/\r?\n/g,'\u2424')});
  }
  return out;
}

for(const mht of mhtFiles){
  console.log('\n-- fixture:', mht);
  const raw = fs.readFileSync(path.join(mhtDir,mht),'utf8');
  const noF = parseMht(raw, { EnableCharsetFallback: false });
  const yesF = parseMht(raw, { EnableCharsetFallback: true });
  const noHtml = noF && noF.html ? noF.html : (noF && noF.output) || '';
  const yesHtml = yesF && yesF.html ? yesF.html : (yesF && yesF.output) || '';
  const nctl = findControls(noHtml);
  const yctl = findControls(yesHtml);
  console.log(' noFallback length', noHtml.length, 'controls:', nctl.length);
  if(nctl.length) console.log('  sample noFallback:', nctl.slice(0,3));
  console.log(' withFallback length', yesHtml.length, 'controls:', yctl.length);
  if(yctl.length) console.log('  sample withFallback:', yctl.slice(0,3));

  // If controls remain, dump raw HTML part BodyRaw and a hex preview to inspect bytes
  if ((nctl.length || yctl.length) && mhtModule) {
    // find html part by reparsing quickly
    const p = (function(){
      const all = rawTextToParts(raw);
      return all.find(pp=>/text\/html/i.test(pp.ContentType));
    })();
    if (p && p.BodyRaw) {
      const br = p.BodyRaw;
      console.log('  raw HTML part sample (first 300 chars):');
      console.log(br.slice(0,300).replace(/\r?\n/g,'\\n'));
        // try to locate the decoded snippet inside the raw quoted-printable body
        const ctl = nctl[0] || yctl[0];
        if (ctl) {
          const key = ctl.snippet.replace(/[\u0000-\u001F\uFFFD]/g, '').slice(0,40).trim();
          if (key && br.indexOf(key) >= 0) {
            const pos = br.indexOf(key);
            console.log('  found key in BodyRaw at', pos);
            console.log('  BodyRaw around match:', br.slice(Math.max(0,pos-60), pos+60).replace(/\r?\n/g,'\\n'));
          } else {
            console.log('  could not locate decoded snippet text in BodyRaw');
          }
        }
      try {
        const enc = new TextEncoder().encode(br);
        const hex = Array.from(enc.slice(0,80)).map(b=>b.toString(16).padStart(2,'0')).join(' ');
        console.log('  hex (first 80 UTF-8 bytes):', hex);
      } catch {}
    }
  }
}

// helper to parse headers/parts quickly (copied minimal logic)
function rawTextToParts(rawText){
  const parts = [];
  const boundaryMatch = rawText.match(/boundary=?"?([^"\r\n;]+)"?/i);
  const boundary = boundaryMatch ? boundaryMatch[1] : null;
  const sep = boundary ? `--${boundary}` : null;
  const rawParts = sep ? rawText.split(sep) : rawText.split(/\r?\n--[^\r\n]+\r?\n/);
  for(const part of rawParts){
    const t = part.trim(); if(!t) continue;
    const splitIndex = t.search(/\r?\n\r?\n/);
    let headerBlock=''; let body='';
    if(splitIndex>=0){ headerBlock = t.slice(0,splitIndex); body = t.slice(splitIndex).replace(/^\r?\n/,''); }
    else body = t;
    // crude content-type extraction
    const m = headerBlock.match(/Content-Type:\s*([^;\r\n]+)/i);
    const ct = m ? m[1].trim() : '';
    parts.push({ContentType: ct, BodyRaw: body});
  }
  return parts;
}
