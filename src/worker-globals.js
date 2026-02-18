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

// Capture uncaught errors and unhandled rejections early in the worker's
// lifecycle (import-time or runtime) and post a diagnostic message back to
// the main thread so failures are observable in the UI.
try {
  if (typeof self !== 'undefined' && self) {
    self.addEventListener('error', (ev) => {
      try {
        console.error('[worker-globals] uncaught error', ev.message, ev.filename, ev.lineno, ev.colno, ev.error);
        if (typeof self.postMessage === 'function') {
          self.postMessage({
            id: 'init',
            status: 'error',
            phase: 'error',
            error: String(ev.message),
            filename: ev.filename,
            lineno: ev.lineno,
            colno: ev.colno,
            stack: ev.error && ev.error.stack
          });
        }
      } catch (ignore) { /* swallow logging errors */ }
    });

    self.addEventListener('unhandledrejection', (ev) => {
      try {
        console.error('[worker-globals] unhandledrejection', ev.reason);
        if (typeof self.postMessage === 'function') {
          self.postMessage({
            id: 'init',
            status: 'error',
            phase: 'unhandledrejection',
            error: String(ev.reason && ev.reason.message ? ev.reason.message : ev.reason),
            reason: ev.reason && (ev.reason.stack || String(ev.reason))
          });
        }
      } catch (ignore) { /* swallow logging errors */ }
    });
  }
} catch (ignore) { /* defensive */ }

export default null;
