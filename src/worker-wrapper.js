// src/worker-wrapper.js
export default class WorkerManager {
  constructor(workerPath = 'src/worker.js') {
    this.worker = new Worker(workerPath, { type: 'module' });
    this.callbacks = new Map();

    this.worker.onmessage = async (e) => {
      const msg = e.data;
      const cb = this.callbacks.get(msg.id);
      if (!cb) return;

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

          const result = await pipelineMod.runPipeline(htmlInput, Object.assign({}, payload.config || {}, { imageMap }));
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

  enqueue(payload, onprogress) {
    return new Promise((resolve, reject) => {
      this.callbacks.set(payload.id, { resolve, reject, onprogress, payload });
      this.worker.postMessage(payload);
    });
  }
}
