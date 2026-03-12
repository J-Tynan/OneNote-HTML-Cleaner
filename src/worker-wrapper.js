// src/worker-wrapper.js
import { createLogger, setEnabled as setLogEnabled } from './logging.js';
import { preparePipelineInputFromPayload } from './pipeline/mhtPayloadPreparation.js';
const logger = createLogger('worker-wrapper');

const UNSUPPORTED_FALLBACK_CODES = new Set([
  'worker-dom-unavailable'
]);

const HANDSHAKE_TIMEOUT_MS = 5000;
const JOB_TIMEOUT_MS = 120000;
const RECENTLY_HANDLED_TTL_MS = 30000;
const MAX_PENDING_CALLBACKS = 1000;

export default class WorkerManager {
  constructor(workerPath = './worker.js', options = {}) {
    try { setLogEnabled(typeof window !== 'undefined' && window && window.LOGGING_ENABLED !== false); } catch (_) {}
    // Resolve worker script relative to this module so it works on GitHub Pages subpaths
    const resolved = new URL(workerPath, import.meta.url).href;
    logger.info({ msg: 'creating worker from', meta: { resolved } });
    try {
      this.worker = new Worker(resolved, { type: 'module' });
    } catch (err) {
      logger.error({ msg: 'failed to construct Worker', meta: { resolved, error: err && err.message ? err.message : String(err) } });
      throw err;
    }

    // Handshake / buffering state
    this.ready = false; // becomes true when worker posts { type: 'ready' }
    this.pendingQueue = []; // queued payloads while worker initializes
    // Release-path guardrail: a worker that cannot handshake within 5 seconds
    // is treated as broken so queued conversions fail deterministically.
    this.handshakeTimeoutMs = Number.isFinite(options.handshakeTimeoutMs)
      ? Math.max(0, options.handshakeTimeoutMs)
      : HANDSHAKE_TIMEOUT_MS;
    this.workerUrl = resolved; // expose resolved worker URL for diagnostics

    // Start a short handshake timer to avoid indefinite buffering. When the
    // timer fires emit a reserved diagnostic (`__diag__`) so support tooling
    // can detect handshake failures reliably. Expose the handler for tests so
    // we can trigger the timeout deterministically in Playwright.
    this._onHandshakeTimeout = () => {
      if (!this.ready) {
        const diag = this._createDiagnostic({
          id: '__diag__',
          type: 'handshake-timeout',
          timestamp: Date.now(),
          pendingCount: this.pendingQueue.length,
          workerUrl: this.workerUrl,
          timeoutMs: this.handshakeTimeoutMs
        });
        this._pushDiagnostic(diag);

        logger.error({ msg: 'worker handshake timed out', meta: { timeoutMs: this.handshakeTimeoutMs, pendingCount: this.pendingQueue.length, workerUrl: this.workerUrl } });
        try {
          logger.warn({ msg: 'handshake diagnostic', meta: diag });
        } catch (ignore) {}

        // Reject queued payloads with a clear diagnostic and cancel callbacks
        for (const queued of this.pendingQueue) {
          const cb = this.callbacks.get(queued.payload.id);
          if (cb) {
            if (cb.timeoutHandle) clearTimeout(cb.timeoutHandle);
            cb.reject({ id: queued.payload.id, status: 'error', error: 'Worker handshake timeout' });
            this.callbacks.delete(queued.payload.id);
          }
        }
        this.pendingQueue = [];
      }
    };

    this._handshakeTimer = setTimeout(this._onHandshakeTimeout, this.handshakeTimeoutMs);

    this.callbacks = new Map();
    // map wrapperId -> original caller id (may be null)
    this._wrapperToOriginal = new Map();
    // set of recently handled wrapperIds (for duplicate-response detection)
    this._recentlyHandled = new Set();
    // Release-path guardrail: allow long conversions, but bound hung jobs.
    this.defaultTimeoutMs = Number.isFinite(options.defaultTimeoutMs)
      ? Math.max(0, options.defaultTimeoutMs)
      : JOB_TIMEOUT_MS;

    // In-memory diagnostics buffer (capped) for unmatched messages / worker diagnostics
    this.diagnostics = [];
    this._diagnosticsMax = 50;

    // configuration
    // Release-path guardrail: cap unresolved callbacks to avoid unbounded growth
    // if the UI or worker starts queueing jobs faster than they complete.
    this.maxPendingCallbacks = Number.isFinite(options.maxPendingCallbacks)
      ? Math.max(1, options.maxPendingCallbacks)
      : MAX_PENDING_CALLBACKS;
    this.recentlyHandledTtlMs = Number.isFinite(options.recentlyHandledTtlMs)
      ? Math.max(0, options.recentlyHandledTtlMs)
      : RECENTLY_HANDLED_TTL_MS;

    this.rejectAllPending = (reason) => {
      for (const [id, cb] of this.callbacks.entries()) {
        if (cb && cb.timeoutHandle) {
          clearTimeout(cb.timeoutHandle);
        }
        cb.reject({ id, status: 'error', error: reason });
      }
      this.callbacks.clear();
    };

    this.worker.onerror = (event) => {
      const baseMessage = event && event.message
        ? event.message
        : 'Worker failed before completing queued jobs';
      const fileInfo = event && event.filename
        ? ` (${event.filename}${event.lineno ? `:${event.lineno}` : ''}${event.colno ? `:${event.colno}` : ''})`
        : '';
      const message = `${baseMessage}${fileInfo}`;
      logger.error({ msg: 'worker error', meta: { message, filename: event && event.filename, lineno: event && event.lineno, colno: event && event.colno } });
      this.rejectAllPending(message);
    };

    this.worker.onmessageerror = (event) => {
      logger.error({ msg: 'worker message error', meta: { event: String(event) } });
      this.rejectAllPending('Worker message serialization failed');
    };

    this.worker.onmessage = async (e) => {
      const msg = e.data;

      // quick sanity validation for any message received
      if (!this.validateMessage(msg)) {
        return;
      }

      // Handle explicit worker handshake message
      if (msg && msg.type === 'ready') {
        this.ready = true;
        if (this._handshakeTimer) {
          clearTimeout(this._handshakeTimer);
          this._handshakeTimer = null;
        }
        logger.info({ msg: 'received ready from worker', meta: msg });

        // Flush any queued payloads now that the worker is ready
        while (this.pendingQueue.length) {
          const q = this.pendingQueue.shift();
          try {
            logger.info({ id: q.payload.id, msg: 'flushing queued message', meta: { file: q.payload.fileName || q.payload.relativePath } });
            this.worker.postMessage(q.payload, q.transferList);
          } catch (err) {
            const cbQueued = this.callbacks.get(q.payload.id);
            if (cbQueued) {
              if (cbQueued.timeoutHandle) clearTimeout(cbQueued.timeoutHandle);
              cbQueued.reject({ id: q.payload.id, status: 'error', error: String(err) });
              this.callbacks.delete(q.payload.id);
            }
          }
        }

        return; // handshake message handled
      }

      const cb = this.callbacks.get(msg && msg.id);

      // Special-case worker-origin diagnostics (do not treat as regular callbacks)
      // recognize diagnostics by a reserved `type` value; id may also be
      // '__diag__' for backward compatibility.
      if (msg && (msg.type === '__diag__' || msg.id === '__diag__')) {
        try {
          const diag = this._createDiagnostic({
            kind: 'worker-diagnostic',
            timestamp: Date.now(),
            payload: msg,
            pendingCallbacks: this.callbacks.size,
            workerUrl: this.workerUrl,
            source: msg.source || 'worker'
          });
          this._pushDiagnostic(diag);
          logger.info({ msg: 'worker diagnostic received', meta: diag });
        } catch (ignore) {}
        return;
      }

      if (!cb) {
        // maybe this is a duplicate of a previously-handled id?
        if (msg && msg.id && this._recentlyHandled.has(msg.id)) {
          // record duplicate-response diagnostic
          const dup = this._createDiagnostic({
            kind: 'duplicate-response',
            id: msg.id,
            status: msg.status || msg.type,
            timestamp: Date.now(),
            workerUrl: this.workerUrl,
            note: 'worker sent a second message for the same id',
            pendingCallbacks: this.callbacks.size
          });
          this._pushDiagnostic(dup);
          logger.warn({ msg: 'duplicate worker response', meta: dup });
          return;
        }

        // Structured unmatched-message logging + store into diagnostics buffer
        try {
          const summary = this._createDiagnostic({
            kind: 'unmatched-message',
            id: msg && msg.id,
            status: msg && (msg.status || msg.type),
            size: msg && msg.outputHtml ? String((msg.outputHtml || '').length) : undefined,
            timestamp: Date.now(),
            pendingCallbacks: this.callbacks.size,
            workerUrl: this.workerUrl,
            preview: this.summarizePayload(msg, 256)
          });

          this._pushDiagnostic(summary);
          logger.warn({ msg: 'unmatched worker message (stored diagnostic)', meta: summary });
        } catch (ignore) {}
        return;
      }

      if (cb.timeoutHandle) {
        clearTimeout(cb.timeoutHandle);
      }

      if (msg.status === 'done') {
        this._attachOriginalId(msg);
        cb.resolve(msg);
        this.callbacks.delete(msg.id);
        this._markHandled(msg.id);
      } else if (msg.status === 'error') {
        this._attachOriginalId(msg);
        cb.reject(msg);
        this.callbacks.delete(msg.id);
        this._markHandled(msg.id);
      } else if (msg.status === 'progress' && cb.onprogress) {
        cb.onprogress(msg);
      } else if (msg.status === 'unsupported') {
        if (!this.canFallbackFromUnsupported(msg)) {
          this._attachOriginalId(msg);
          cb.reject(msg);
          this.callbacks.delete(msg.id);
          this._markHandled(msg.id);
          logger.info({ msg: 'worker unsupported without fallback', meta: { code: msg.code, reason: msg.reason } });
          return;
        }
        // Worker cannot run DOM-based pipeline. Fallback to main-thread processing.
        try {
          logger.warn({ msg: 'worker unsupported, falling back to main thread', meta: { reason: msg.reason } });
          // Dynamically import pipeline and mht parser in main thread
          const [pipelineMod, mhtMod, exportFinalizerMod] = await Promise.all([
            import('./pipeline/pipeline.js'),
            import('./pipeline/mht.js'),
            import('./convert/exportFinalizer.js')
          ]);
          const payload = cb.payload;
          const {
            fileName,
            sourceKind,
            htmlInput,
            imageMap,
            parseWarnings,
            mhtPreparation
          } = preparePipelineInputFromPayload({
            payload,
            parseMht: mhtMod.parseMht
          });

          if (mhtPreparation.attempted) {
            logger.info({ msg: 'main-thread parseMht for', meta: { fileName } });
            if (mhtPreparation.parsed) {
              logger.info({ msg: 'parseMht produced html length', meta: { htmlLength: htmlInput.length } });
            } else {
              logger.warn({ msg: 'parseMht returned no HTML; proceeding with original payload.html' });
            }
          }
          const result = await pipelineMod.runPipeline(htmlInput, Object.assign({}, payload.config || {}, {
            imageMap,
            ParseWarnings: parseWarnings,
            SourceName: fileName || payload.relativePath || 'Converted file',
            SourceKind: sourceKind
          }));
          const response = exportFinalizerMod.finalizePipelineOutput({ id: msg.id, payload, result });
          // preserve original id mapping if available
          this._attachOriginalId(response);
          cb.resolve(response);
        } catch (err) {
          const errorObj = { id: msg.id, status: 'error', error: String(err) };
          this._attachOriginalId(errorObj);
          cb.reject(errorObj);
        } finally {
          this.callbacks.delete(msg.id);
        }
      }
    };

    // Request the worker to perform explicit initialization now that the
    // wrapper has installed message handlers. This defers the worker's
    // dynamic imports until the wrapper controls the handshake lifecycle.
    try {
      logger.info({ msg: 'sending init to worker', meta: { workerUrl: this.workerUrl } });
      this.worker.postMessage({ type: 'init', options: {} });
    } catch (err) {
      logger.warn({ msg: 'failed to send init message', meta: { error: err && err.message ? err.message : String(err) } });
    }
  }

  // Validate incoming messages from the worker. This helps catch
  // malformed payloads early and prevents runtime exceptions or
  // mis-routed callbacks. If a message is invalid a diagnostic is stored
  // and the function returns false so the caller can bail out.
  _createDiagnostic(detail = {}) {
    const diag = Object.assign({}, detail);
    diag.timestamp = diag.timestamp || Date.now();
    diag.source = diag.source || 'wrapper';
    diag.workerUrl = diag.workerUrl || this.workerUrl;
    if (!diag.type) {
      diag.type = '__diag__';
    }
    return diag;
  }

  _dispatchDiagnostic(diag) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
      return;
    }
    window.dispatchEvent(new CustomEvent('worker-diagnostic', { detail: diag }));
  }

  // push a diagnostic into the capped buffer and emit the DOM event once.
  _pushDiagnostic(diag) {
    try {
      if (!diag || typeof diag !== 'object') return;
      const normalized = this._createDiagnostic(diag);
      this.diagnostics.push(normalized);
      if (this.diagnostics.length > this._diagnosticsMax) this.diagnostics.shift();
      this._dispatchDiagnostic(normalized);
    } catch (ignore) {}
  }

  _attachOriginalId(message) {
    if (!message || !message.id || !this._wrapperToOriginal.has(message.id)) {
      return message;
    }
    message.originalId = this._wrapperToOriginal.get(message.id);
    this._wrapperToOriginal.delete(message.id);
    return message;
  }

  _markHandled(id) {
    if (!id) return;
    this._recentlyHandled.add(id);
    setTimeout(() => this._recentlyHandled.delete(id), this.recentlyHandledTtlMs);
  }

  validateMessage(msg) {
    if (!msg || typeof msg !== 'object') {
      const diag = this._createDiagnostic({
        kind: 'invalid-message',
        payload: msg,
        note: 'received non-object message from worker',
        pendingCallbacks: this.callbacks.size
      });
      this._pushDiagnostic(diag);
      logger.warn({ msg: 'invalid worker message', meta: { msg } });
      return false;
    }
    // diagnostics messages are allowed to omit id
    if (msg.type === '__diag__' || msg.id === '__diag__') return true;
    if (!msg.id || typeof msg.id !== 'string') {
      const diag = this._createDiagnostic({
        kind: 'missing-id',
        payload: msg,
        note: 'worker message missing id',
        pendingCallbacks: this.callbacks.size
      });
      this._pushDiagnostic(diag);
      logger.warn({ msg: 'worker message without id', meta: { msg } });
      return false;
    }
    return true;
  }

  // Return a short, safe summary for logging (avoid dumping full HTML)
  summarizePayload(payload, maxChars = 256) {
    try {
      if (!payload) return '';
      const parts = [];
      if (payload.type) parts.push(`type=${payload.type}`);
      if (payload.fileName) parts.push(`file=${payload.fileName}`);
      else if (payload.relativePath) parts.push(`file=${payload.relativePath}`);
      if (payload.status) parts.push(`status=${payload.status}`);
      if (payload.outputHtml) parts.push(`outputLen=${(payload.outputHtml || '').length}`);
      const s = parts.join('; ');
      return s.length > maxChars ? s.slice(0, maxChars) + '…' : s;
    } catch (e) {
      return '';
    }
  }

  // Expose recent diagnostics captured from worker/unmatched messages
  getDiagnostics() {
    return this.diagnostics.slice();
  }

  // number of currently unresolved callbacks
  getPendingCount() {
    return this.callbacks.size;
  }

  canFallbackFromUnsupported(msg) {
    if (!msg || typeof msg !== 'object') return false;
    if (msg.code && UNSUPPORTED_FALLBACK_CODES.has(msg.code)) return true;
    return msg.reason === 'DOMParser not available in worker';
  }

  enqueue(payload, onprogress, transferList = [], timeoutMs = this.defaultTimeoutMs) {
    // Wrapper now always assigns its own authoritative ID. If the caller
    // supplied one we remember it so we can echo it back later.
    let clientId = null;
    try {
      if (!payload || typeof payload !== 'object') payload = {};
      if (payload.id && typeof payload.id === 'string') {
        clientId = payload.id;
      }
    } catch (e) {}
    // generate wrapper ID
    let wrapperId;
    try {
      wrapperId = crypto.randomUUID();
    } catch (e) {
      wrapperId = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
    }
    payload.id = wrapperId;
    this._wrapperToOriginal.set(wrapperId, clientId);

    // enforce max pending callback count
    if (this.callbacks.size >= this.maxPendingCallbacks) {
      const diag = this._createDiagnostic({
        kind: 'overflow',
        note: 'max pending callbacks exceeded',
        pendingCallbacks: this.callbacks.size,
        max: this.maxPendingCallbacks
      });
      this._pushDiagnostic(diag);
      logger.error({ msg: 'cannot enqueue payload, max pending reached', meta: diag });
      return Promise.reject({ id: wrapperId, status: 'error', error: 'max pending callbacks exceeded' });
    }

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        const active = this.callbacks.get(payload.id);
        if (!active) return;
        this.callbacks.delete(payload.id);
        reject({ id: payload.id, status: 'error', error: `Worker timeout after ${timeoutMs}ms` });
      }, timeoutMs);

      this.callbacks.set(payload.id, { resolve, reject, onprogress, payload, timeoutHandle });

      // If the worker hasn't finished its handshake yet, queue the payload
      if (!this.ready) {
        logger.info({ id: payload.id, msg: 'worker not ready — queueing payload' });
        this.pendingQueue.push({ payload, transferList });
        return;
      }

      try {
        logger.info({ id: payload.id, msg: 'posting message to worker', meta: { file: payload.fileName || payload.relativePath } });
        this.worker.postMessage(payload, transferList);
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.callbacks.delete(payload.id);
        reject({ id: payload.id, status: 'error', error: String(error) });
      }
    });
  }
}
