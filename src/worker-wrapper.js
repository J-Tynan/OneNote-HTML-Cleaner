// src/worker-wrapper.js
export default class WorkerManager {
  constructor(workerPath = './worker.js') {
    // Resolve worker script relative to this module so it works on GitHub Pages subpaths
    const resolved = new URL(workerPath, import.meta.url).href;

    // If a service worker is controlling the page, append a cache-busting
    // query so the browser requests the latest `worker.js` instead of a
    // stale cached version. This is a conservative, reversible fallback.
    const shouldCacheBust = (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller);
    const resolvedForWorker = shouldCacheBust ? `${resolved}?_=${Date.now()}` : resolved;

    // DEBUG_WORKER: toggle for worker-wrapper informational logs in development
    const DEBUG_WORKER = false;
    const debugWorker = (...args) => {
      if (!DEBUG_WORKER) return;
      if (args.length === 0) return;
      const [first, ...rest] = args;
      if (typeof first === 'string' && /^\s*\[worker-wrapper\]/i.test(first)) {
        console.log(first, ...rest);
      } else {
        console.log('[Worker]', ...args);
      }
    };

    debugWorker('[worker-wrapper] creating worker from', resolvedForWorker);
    try {
      this.worker = new Worker(resolvedForWorker, { type: 'module' });
    } catch (err) {
      console.error('[worker-wrapper] failed to construct Worker with', resolved, err);
      throw err;
    }

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
      const cb = this.callbacks.get(msg.id);
      if (!cb) return;

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
            debugWorker('[worker-wrapper] main-thread parseMht for', fileName);
            const parsed = mhtMod.parseMht(htmlInput);
            if (parsed && parsed.html) {
              htmlInput = parsed.html;
              imageMap = Object.assign({}, imageMap, parsed.imageMap || {});
              debugWorker('[worker-wrapper] parseMht produced html length', htmlInput.length);
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

      try {
        debugWorker('[worker-wrapper] posting message to worker id=', payload.id, 'file=', payload.fileName || payload.relativePath);
        this.worker.postMessage(payload, transferList);
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.callbacks.delete(payload.id);
        reject({ id: payload.id, status: 'error', error: String(error) });
      }
    });
  }
}
