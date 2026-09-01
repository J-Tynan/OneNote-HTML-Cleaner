// @ts-check
// src/worker-globals.js
const _workerGlobal = (typeof globalThis !== 'undefined' && globalThis) || null;

import { createLogger } from './logging.js';
const logger = createLogger('worker-globals');

/**
 * @typedef {import('./contracts.js').WorkerDiagnosticMessage} WorkerDiagnosticMessage
 * @typedef {Partial<WorkerDiagnosticMessage> & Record<string, unknown>} WorkerDiagnosticInput
 */

// Short stable fingerprint for the worker module (used in diagnostics).
/**
 * @param {unknown} s
 * @returns {string}
 */
function _shortHexHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(s || '').length; i++) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

/** @type {string | null} */
const _workerUrl = (typeof import.meta !== 'undefined' && import.meta.url) || (typeof self !== 'undefined' && self && self.location && self.location.href) || null;
const _workerUrlHash = _workerUrl ? _shortHexHash(_workerUrl) : null;

// Capture uncaught errors and unhandled rejections early in the worker's
// lifecycle (import-time or runtime) and post a diagnostic message back to
// the main thread so failures are observable in the UI.
try {
  if (typeof self !== 'undefined' && self) {
    self.addEventListener('error', (ev) => {
      try {
        logger.error({ msg: 'uncaught error', meta: { message: ev.message, filename: ev.filename, lineno: ev.lineno, colno: ev.colno, error: ev.error } });
        // Post a structured diagnostic using the helper so payloads are consistent.
        postDiagnostic({
          id: 'init',
          status: 'error',
          phase: 'error',
          msg: String(ev.message),
          meta: { filename: ev.filename, lineno: ev.lineno, colno: ev.colno, stack: ev.error && ev.error.stack }
        });
      } catch (ignore) { /* swallow logging errors */ }
    });

    self.addEventListener('unhandledrejection', (ev) => {
      try {
        logger.error({ msg: 'unhandledrejection', meta: { reason: ev.reason } });
        postDiagnostic({
          id: 'init',
          status: 'error',
          phase: 'unhandledrejection',
          msg: String(ev.reason && ev.reason.message ? ev.reason.message : ev.reason),
          meta: { reason: ev.reason && (ev.reason.stack || String(ev.reason)) }
        });
      } catch (ignore) { /* swallow logging errors */ }
    });
  }
} catch (ignore) { /* defensive */ }

// A safe, structured diagnostic helper available at import-time via a named
// export. It will safely fall back to logger output when `postMessage` is
// unavailable.
/**
 * @param {WorkerDiagnosticInput} [detail]
 * @returns {void}
 */
export function postDiagnostic(detail = {}) {
  try {
    const status = typeof detail.status === 'string' && detail.status ? detail.status : 'info';
    const level = (status === 'error') ? 'error' : (status === 'warn' || status === 'warning') ? 'warn' : 'info';
    const msg = String(detail.msg || detail.message || detail.error || detail.phase || '');

    /** @type {WorkerDiagnosticMessage} */
    const payload = Object.assign({
      id: typeof detail.id === 'string' && detail.id ? detail.id : 'diag',
      type: '__diag__',
      status,
      level,
      phase: detail.phase || 'diagnostic',
      msg,
      meta: detail.meta || detail.details || undefined,
      timestamp: Date.now()
    }, detail, {
      source: 'worker',
      workerUrl: _workerUrl,
      workerHash: _workerUrlHash
    });

    if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
      self.postMessage(payload);
    } else {
      // Not in a worker context — surface to console for local/dev runs.
      try { logger.info({ msg: 'postDiagnostic (fallback)', meta: payload }); } catch (_) {}
    }
  } catch (ignore) { /* swallow */ }
}

export default null;
