const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const src = path.join(root, 'service-worker.js');
const tmp = path.join(root, 'service-worker.copy.js');
try {
  fs.copyFileSync(src, tmp);
  const newName = 'onenote-cleaner-v-test-99';
  const cmd = process.execPath; // node
  const args = [path.join(root, 'scripts', 'bump-sw-cache.js'), `--set=${newName}`, `--file=${tmp}`, '--yes'];
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('bump script failed: ' + r.stdout + '\n' + r.stderr);
  const after = fs.readFileSync(tmp, 'utf8');
  if (!after.includes(newName)) throw new Error('cache name not updated in temp file');
  console.log('test:sw-bump: OK');
  fs.unlinkSync(tmp);
  process.exit(0);
} catch (err) {
  try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch(_){}
  console.error('test:sw-bump: FAIL', err && err.stack ? err.stack : err);
  process.exit(1);
}
