import { postDiagnostic } from '../src/worker-globals.js';

// capture payload via mock postMessage
let captured = null;
// workers refer to `self`; alias to globalThis and stub postMessage
if (typeof globalThis !== 'undefined') {
  globalThis.self = globalThis;
  globalThis.postMessage = (p) => { captured = p; };
}

postDiagnostic({ id: 'test', status: 'warn', msg: 'hello', meta: { foo: 'bar' } });

if (!captured) {
  console.error('diagnostic-schema: FAIL no payload posted');
  process.exit(1);
}
if (captured.type !== '__diag__') {
  console.error('diagnostic-schema: FAIL type not __diag__', captured);
  process.exit(1);
}
if (captured.source !== 'worker') {
  console.error('diagnostic-schema: FAIL source not worker', captured);
  process.exit(1);
}
if (!captured.timestamp) {
  console.error('diagnostic-schema: FAIL missing timestamp', captured);
  process.exit(1);
}
console.log('diagnostic-schema: OK');
process.exit(0);
