// src/worker-wrapper.js
import { info as logInfo, warn as logWarn, error as logError } from './logging.js';

export default class WorkerManager {
  constructor(workerPath = './worker.js') {
    // Resolve worker script relative to this module so it works on GitHub Pages subpaths
    const resolved = new URL(workerPath, import.meta.url).href;
    logInfo('worker-wrapper', { msg: 'creating worker from', meta: { resolved } });
    try {
      this.worker = new Worker(resolved, { type: 'module' });
    } catch (err) {
      logError('worker-wrapper', { msg: 'failed to construct Worker', meta: { resolved, error: err && err.message ? err.message : String(err) } });
      throw err;
    }

    // Handshake / buffering state
    this.ready = false; // becomes true when worker posts { type: 'ready' }
    this.pendingQueue = []; // queued payloads while worker initializes
    this.handshakeTimeoutMs = 5000; // fail-fast if worker doesn't handshake
    this.workerUrl = resolved; // expose resolved worker URL for diagnostics

    // Start a short handshake timer to avoid indefinite buffering. When the
    // timer fires emit a reserved diagnostic (`__diag__`) so support tooling
    // can detect handshake failures reliably. Expose the handler for tests so
    // we can trigger the timeout deterministically in Playwright.
    this._onHandshakeTimeout = () => {
      if (!this.ready) {
        const diag = {
          id: '__diag__',
          type: 'handshake-timeout',
          timestamp: Date.now(),
          pendingCount: this.pendingQueue.length,
          workerUrl: this.workerUrl,
          timeoutMs: this.handshakeTimeoutMs
        };
        // store handshake-timeout in diagnostics buffer so UI/tests can observe it
        try {
          this.diagnostics.push(diag);
          if (this.diagnostics.length > this._diagnosticsMax) this.diagnostics.shift();
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            try { window.dispatchEvent(new CustomEvent('worker-diagnostic', { detail: diag })); } catch (__) {}
          }
        } catch (ignore) {}

        logError('worker-wrapper', { msg: 'worker handshake timed out', meta: { timeoutMs: this.handshakeTimeoutMs, pendingCount: this.pendingQueue.length, workerUrl: this.workerUrl } });
        try {
          logWarn('worker-wrapper', { msg: 'handshake diagnostic', meta: diag });
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
    this.defaultTimeoutMs = 120000;

    // In-memory diagnostics buffer (capped) for unmatched messages / worker diagnostics
    this.diagnostics = [];
    this._diagnosticsMax = 50;

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
      logError('worker-wrapper', { msg: 'worker error', meta: { message, filename: event && event.filename, lineno: event && event.lineno, colno: event && event.colno } });
      this.rejectAllPending(message);
    };

    this.worker.onmessageerror = (event) => {
      logError('worker-wrapper', { msg: 'worker message error', meta: { event: String(event) } });
      this.rejectAllPending('Worker message serialization failed');
    };

    this.worker.onmessage = async (e) => {
      const msg = e.data;

      // Handle explicit worker handshake message
      if (msg && msg.type === 'ready') {
        this.ready = true;
        if (this._handshakeTimer) {
          clearTimeout(this._handshakeTimer);
          this._handshakeTimer = null;
        }
        logInfo('worker-wrapper', { msg: 'received ready from worker', meta: msg });

        // Flush any queued payloads now that the worker is ready
        while (this.pendingQueue.length) {
          const q = this.pendingQueue.shift();
          try {
            logInfo('worker-wrapper', { id: q.payload.id, msg: 'flushing queued message', meta: { file: q.payload.fileName || q.payload.relativePath } });
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
      if (msg && msg.id === '__diag__') {
        try {
          const diag = {
            kind: 'worker-diagnostic',
            timestamp: Date.now(),
            payload: msg,
            pendingCallbacks: this.callbacks.size,
            workerUrl: this.workerUrl
          };
          // push into capped diagnostics buffer for later inspection
          this.diagnostics.push(diag);
          if (this.diagnostics.length > this._diagnosticsMax) this.diagnostics.shift();
          try {
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
              window.dispatchEvent(new CustomEvent('worker-diagnostic', { detail: diag }));
            }
          } catch (ignore) {}
          logInfo('worker-wrapper', { msg: 'worker diagnostic received', meta: diag });
        } catch (ignore) {}
        return;
      }

      if (!cb) {
        // Structured unmatched-message logging + store into diagnostics buffer
        try {
          const summary = {
            kind: 'unmatched-message',
            id: msg && msg.id,
            status: msg && (msg.status || msg.type),
            size: msg && msg.outputHtml ? String((msg.outputHtml || '').length) : undefined,
            timestamp: Date.now(),
            pendingCallbacks: this.callbacks.size,
            workerUrl: this.workerUrl,
            preview: this.summarizePayload(msg, 256)
          };

          this.diagnostics.push(summary);
          if (this.diagnostics.length > this._diagnosticsMax) this.diagnostics.shift();
          try {
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
              window.dispatchEvent(new CustomEvent('worker-diagnostic', { detail: summary }));
            }
          } catch (ignore) {}

          logWarn('worker-wrapper', { msg: 'unmatched worker message (stored diagnostic)', meta: summary });
        } catch (ignore) {}
        return;
      }

      if (cb.timeoutHandle) {
        clearTimeout(cb.timeoutHandle);
      }

      if (msg.status === 'done') {
        cb.resolve(msg);
        this.callbacks.delete(msg.id);
      } else if (msg.status === 'error') {
        cb.reject(msg);
        this.callbacks.delete(msg.id);
      } else if (msg.status === 'progress' && cb.onprogress) {
        cb.onprogress(msg);
      } else if (msg.status === 'unsupported') {
        // Worker cannot run DOM-based pipeline. Fallback to main-thread processing.
        try {
          logWarn('worker-wrapper', { msg: 'worker unsupported, falling back to main thread', meta: { reason: msg.reason } });
          // Dynamically import pipeline and mht parser in main thread
          const [pipelineMod, mhtMod] = await Promise.all([
            import('./pipeline/pipeline.js'),
            import('./pipeline/mht.js')
          ]);
          const payload = cb.payload;
          let htmlInput = payload.html || '';
          let imageMap = (payload.config && payload.config.imageMap) || {};

          const fileName = payload.fileName || payload.relativePath || '';
          if (/\.(mht|mhtml)$/i.test(fileName) || (payload.mimetype && /multipart\/related/i.test(payload.mimetype))) {
            logInfo('worker-wrapper', { msg: 'main-thread parseMht for', meta: { fileName } });
            const parsed = mhtMod.parseMht(htmlInput);
            if (parsed && parsed.html) {
              htmlInput = parsed.html;
              imageMap = Object.assign({}, imageMap, parsed.imageMap || {});
              logInfo('worker-wrapper', { msg: 'parseMht produced html length', meta: { htmlLength: htmlInput.length } });
            } else {
              logWarn('worker-wrapper', { msg: 'parseMht returned no HTML; proceeding with original payload.html' });
            }
          }

          const sourceKind = payload.sourceKind || (/\.(mht|mhtml)$/i.test(fileName) ? 'mht' : 'html');
          const result = await pipelineMod.runPipeline(htmlInput, Object.assign({}, payload.config || {}, {
            imageMap,
            SourceName: fileName || payload.relativePath || 'Converted file',
            SourceKind: sourceKind
          }));
          const response = {
            id: msg.id,
            status: 'done',
            outputHtml: result.output,
            relativePath: payload.relativePath || payload.fileName,
            logs: result.logs
          };
          cb.resolve(response);
        } catch (err) {
          cb.reject({ id: msg.id, status: 'error', error: String(err) });
        } finally {
          this.callbacks.delete(msg.id);
        }
      }
    };

    // Request the worker to perform explicit initialization now that the
    // wrapper has installed message handlers. This defers the worker's
    // dynamic imports until the wrapper controls the handshake lifecycle.
    try {
      logInfo('worker-wrapper', { msg: 'sending init to worker', meta: { workerUrl: this.workerUrl } });
      this.worker.postMessage({ type: 'init', options: {} });
    } catch (err) {
      logWarn('worker-wrapper', { msg: 'failed to send init message', meta: { error: err && err.message ? err.message : String(err) } });
    }
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

  enqueue(payload, onprogress, transferList = [], timeoutMs = this.defaultTimeoutMs) {
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
        logInfo('worker-wrapper', { id: payload.id, msg: 'worker not ready — queueing payload' });
        this.pendingQueue.push({ payload, transferList });
        return;
      }

      try {
        logInfo('worker-wrapper', { id: payload.id, msg: 'posting message to worker', meta: { file: payload.fileName || payload.relativePath } });
        this.worker.postMessage(payload, transferList);
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.callbacks.delete(payload.id);
        reject({ id: payload.id, status: 'error', error: String(error) });
      }
    });
  }
}
