import fs from 'node:fs';
import path from 'node:path';
const dir = path.join(process.cwd(), 'Tests');
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.mht') || f.toLowerCase().endsWith('.mhtml'));
for(const f of files){
  const p = path.join(dir,f);
  const b = fs.readFileSync(p);
  const bad = [];
  for(let i=0;i<b.length;i++){
    const v=b[i];
    if((v<=8) || (v>=11 && v<=12) || (v>=14 && v<=31)){
      bad.push({i,hex:v.toString(16).padStart(2,'0').toUpperCase()});
      if(bad.length>=10) break;
    }
  }
  console.log(f, 'badCount=', bad.length);
  if(bad.length) console.log(' sample positions:', bad.slice(0,10));
}
