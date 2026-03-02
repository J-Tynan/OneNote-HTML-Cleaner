import fs from 'fs';
import { parseMht } from '../src/pipeline/mht.js';
import { FIXTURE_FILES, resolveFixturePath } from './fixtures.js';

const raw=fs.readFileSync(resolveFixturePath(FIXTURE_FILES.RESOLVE_MERGE_CONFLICTS),'latin1');
const p=parseMht(raw,{EnableMapping:false});
const htmlPart=p.parts.find(pp=>/text\/html/i.test(pp.ContentType));
console.log('BodyRaw length', htmlPart.BodyRaw.length);
console.log('slice 5535-5545', htmlPart.BodyRaw.slice(5535,5545));
console.log('code at 5542', htmlPart.BodyRaw.charCodeAt(5542));
