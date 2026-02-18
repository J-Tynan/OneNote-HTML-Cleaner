// src/worker-globals.js
// Ensure a safe global `debugWorker` exists early during module evaluation.
// Some imported modules may reference `debugWorker` at top-level; defining
// this noop prevents ReferenceError during worker/bootstrap.
const _workerGlobal = (typeof globalThis !== 'undefined' && globalThis)
  || (typeof self !== 'undefined' && self)
  || (typeof window !== 'undefined' && window)
  || null;

if (_workerGlobal && typeof _workerGlobal.debugWorker === 'undefined') {
  _workerGlobal.debugWorker = function debugWorker() { /* noop until overridden */ };
}

export default null;
