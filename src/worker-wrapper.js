// src/worker-wrapper.js
export default class WorkerManager {
  constructor(workerPath = './worker.js') {
    // Resolve worker script relative to this module so it works on GitHub Pages subpaths
    const resolved = new URL(workerPath, import.meta.url).href;
    console.info('[worker-wrapper] creating worker from', resolved);
    try {
      this.worker = new Worker(resolved, { type: 'module' });
    } catch (err) {
      console.error('[worker-wrapper] failed to construct Worker with', resolved, err);
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
        console.error('[worker-wrapper] worker handshake timed out after', this.handshakeTimeoutMs, 'ms');
        try {
          console.warn('[worker-wrapper] diagnostic:', JSON.stringify(diag));
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
      console.error('[worker-wrapper] worker error:', message, event);
      this.rejectAllPending(message);
    };

    this.worker.onmessageerror = (event) => {
      console.error('[worker-wrapper] worker message error:', event);
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
        console.info('[worker-wrapper] received ready from worker', msg);

        // Flush any queued payloads now that the worker is ready
        while (this.pendingQueue.length) {
          const q = this.pendingQueue.shift();
          try {
            console.info('[worker-wrapper] flushing queued message id=', q.payload.id, 'file=', q.payload.fileName || q.payload.relativePath);
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

      const cb = this.callbacks.get(msg.id);
      if (!cb) {
        // Log unmatched message for diagnostics (compact summary)
        try {
          const summary = {
            id: msg && msg.id,
            status: msg && (msg.status || msg.type),
            size: msg && msg.outputHtml ? String((msg.outputHtml || '').length) : undefined
          };
          console.warn('[worker-wrapper] unmatched worker message:', JSON.stringify(summary));
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
          console.warn('[worker-wrapper] worker unsupported, falling back to main thread:', msg.reason);
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
            console.log('[worker-wrapper] main-thread parseMht for', fileName);
            const parsed = mhtMod.parseMht(htmlInput);
            if (parsed && parsed.html) {
              htmlInput = parsed.html;
              imageMap = Object.assign({}, imageMap, parsed.imageMap || {});
              console.log('[worker-wrapper] parseMht produced html length', htmlInput.length);
            } else {
              console.warn('[worker-wrapper] parseMht returned no HTML; proceeding with original payload.html');
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
      console.info('[worker-wrapper] sending init to worker', this.workerUrl);
      this.worker.postMessage({ type: 'init', options: {} });
    } catch (err) {
      console.warn('[worker-wrapper] failed to send init message', err);
    }
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
        console.info('[worker-wrapper] worker not ready — queueing payload id=', payload.id);
        this.pendingQueue.push({ payload, transferList });
        return;
      }

      try {
        console.info('[worker-wrapper] posting message to worker id=', payload.id, 'file=', payload.fileName || payload.relativePath);
        this.worker.postMessage(payload, transferList);
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.callbacks.delete(payload.id);
        reject({ id: payload.id, status: 'error', error: String(error) });
      }
    });
  }
}
