import fs from 'fs';
import { parseMht, decodeQuotedPrintable } from '../src/pipeline/mht.js';

// read fixture and parse with mapping enabled
const raw = fs.readFileSync('Tests/Resolve merge conflicts.mht','utf8');
const p = parseMht(raw, { EnableMapping: true });
const htmlPart = p.parts.find(pp => /text\/html/i.test(pp.ContentType));

console.log('BodyRawStart', htmlPart.BodyRawStart);
console.log('samples', p.controlCharDiagnostics.samples);
const mapping = htmlPart.BodyDecodedMapping;
const sample = p.controlCharDiagnostics.samples[0];
console.log('sample index', sample.index, 'mapping val (parseMht)', mapping[sample.index]);
const qpRes2 = decodeQuotedPrintable(htmlPart.BodyRaw, { withMapping: true });
console.log('mapping val (direct decodeQuotedPrintable)', qpRes2.mapping[sample.index]);
{
  const pos = mapping[sample.index];
  const window = htmlPart.BodyRaw.slice(pos-5, pos+5);
  console.log('bodyRaw snippet', window.replace(/\r?\n/g,'\\n'));
  const codes = [];
  for (let i = pos-2; i <= pos+2; i++) {
    codes.push({i, ch: htmlPart.BodyRaw[i], code: htmlPart.BodyRaw.charCodeAt(i)});
  }
  console.log('around codes', codes);
}

// helper replicates the *new* decodeQuotedPrintable algorithm so we can
// determine which original text index produced each decoded byte.
function decodeQPInfo2(text) {
  const bytes = [];
  const inputIndexForByte = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    // soft break
    if (ch === '=' && i + 1 < text.length && text[i+1] === '\r' && text[i+2] === '\n') {
      i += 2;
      continue;
    }
    if (ch === '=' && i + 2 < text.length) {
      const hex = text.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        inputIndexForByte.push(i);
        i += 2;
        continue;
      }
    }
    bytes.push(text.charCodeAt(i) & 0xff);
    inputIndexForByte.push(i);
  }
  let out = '';
  for (let b of bytes) out += String.fromCharCode(b);
  return { text: out, bytes, inputIndexForByte };
}

const qpInfo2 = decodeQPInfo2(htmlPart.BodyRaw);
console.log('qpInfo2 bytes length', qpInfo2.bytes.length);
for (let i = 0; i < qpInfo2.bytes.length; i++) {
  const b = qpInfo2.bytes[i];
  if ((b >= 0 && b <= 0x08) || (b >= 0x0e && b <= 0x1f)) {
    console.log('control byte at decoded index', i, 'value', b.toString(16), 'srcAt', qpInfo2.inputIndexForByte[i]);
  }
}
