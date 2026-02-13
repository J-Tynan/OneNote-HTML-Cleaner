const fs = require('fs');
const path = require('path');

function readU16(view, off) { return view.getUint16(off, true); }
function readU32(view, off) { return view.getUint32(off, true); }

const filePath = path.join(__dirname, 'Test Notebook.onepkg');
if (!fs.existsSync(filePath)) {
  console.error('Missing test .onepkg:', filePath);
  process.exit(2);
}

const buf = fs.readFileSync(filePath);
const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

if (bytes.length < 36) {
  console.error('File too small to be a CAB');
  process.exit(2);
}

const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
if (sig !== 'MSCF') {
  console.error('Not a CAB (.onepkg) file, signature=', sig);
  process.exit(2);
}

const coffFiles = readU32(dv, 16);
const cFolders = readU16(dv, 26);
console.log('cFolders=', cFolders, 'coffFiles=', coffFiles);

let off = 36;
let foundLzx = false;
for (let i = 0; i < cFolders; i++) {
  if (off + 8 > bytes.length) break;
  const coffCabStart = readU32(dv, off);
  const cCFData = readU16(dv, off + 4);
  const typeCompress = readU16(dv, off + 6);
  const kind = typeCompress & 0x000f;
  const map = { 0: 'none', 1: 'mszip', 2: 'quantum', 3: 'lzx' }[kind] || 'unknown';
  console.log(i, 'coffCabStart=', coffCabStart, 'cCFData=', cCFData, 'typeCompress=0x' + typeCompress.toString(16), '=>', map);
  if (map === 'lzx') foundLzx = true;
  off += 8;
}

if (foundLzx) {
  console.log('\nResult: Contains LZX-compressed CAB folder(s).');
  process.exit(0);
}

console.log('\nResult: No LZX compression detected.');
process.exit(0);
