// src/worker.js
import { postDiagnostic } from './worker-globals.js';
import { detectSourceKind } from './importers/sourceKind.js';

// Module-level placeholders for lazy-loaded modules. These are initialized
// from `init()` so import-time evaluation of heavy modules is avoided.
let _runPipeline = null;
let _parseMht = null;
let _importOneSection = null;
let _importOnePackage = null;

export async function init() {
  try {
    const hasDOMParser = (typeof DOMParser !== 'undefined');
    console.info('[worker] init() — DOMParser available:', hasDOMParser);

    // Lazy-load heavy modules here so any import-time failures are
    // captured and posted as structured diagnostics (worker-globals).
    // Only load the MHT + pipeline modules during worker init for the
    // MHT-only release. Native `.one` / `.onepkg` importers are deferred
    // and will not be loaded at worker startup.
    const imports = await Promise.allSettled([
      import('./pipeline/pipeline.js'),
      import('./pipeline/mht.js')
    ]);

    // Assign successful imports to module-scoped variables
    if (imports[0].status === 'fulfilled') _runPipeline = imports[0].value.runPipeline;
    if (imports[1].status === 'fulfilled') _parseMht = imports[1].value.parseMht;

    // Report any import failures for diagnostics (but still post ready so
    // the wrapper can surface structured diagnostics to the UI).
    const failed = imports
      .map((r, i) => ({ idx: i, status: r.status, reason: r.status === 'rejected' ? String(r.reason) : undefined }))
      .filter((r) => r.status === 'rejected');
    if (failed.length) {
      console.warn('[worker] imports failed during init():', failed);
      try {
        postDiagnostic({ id: 'init', status: 'error', phase: 'init-imports', msg: 'imports failed during init', meta: { failed } });
      } catch (ignore) { /* swallow */ }
    }

    // Post explicit ready handshake after init completes.
    self.postMessage({ type: 'ready', id: 'init', timestamp: Date.now(), hasDOMParser });
    console.info('[worker] posted ready');
  } catch (err) {
    console.error('[worker] init() error', err);
    try {
      postDiagnostic({ id: 'init', status: 'error', phase: 'init', msg: String(err && err.message ? err.message : String(err)), meta: { stack: err && err.stack } });
    } catch (ignore) {}
    throw err;
  }
}

// Do not auto-run `init()` at import time — the wrapper will explicitly
// request initialization with `{ type: 'init' }` so startup is deterministic.

self.onmessage = async (e) => {
  const payload = e.data;

  // Support explicit initialization request from the wrapper. This defers
  // dynamic imports until the wrapper posts `{ type: 'init' }`.
  if (payload && payload.type === 'init') {
    console.info('[worker] received init message from wrapper, starting init()');
    try {
      await init(payload.options || {});
    } catch (err) {
      console.error('[worker] init() failed after init message', err);
    }
    return; // init message handled
  }
  const id = payload.id || crypto.randomUUID();
  const fileName = payload.fileName || payload.relativePath || 'unknown';
  const sourceKind = payload.sourceKind || detectSourceKind(fileName, payload.mimetype);

  console.log(`[worker] received job id=${id} file=${fileName}`);

  try {
    // Native `.one` / `.onepkg` flows are out of scope for the current
    // (MHT-only) release — explicitly mark them unsupported so the UI can
    // surface the correct message and we avoid loading native importers.
    if (sourceKind === 'one' || sourceKind === 'onepkg') {
      console.warn('[worker] native importers are disabled in this release for', sourceKind);
      self.postMessage({ id, status: 'unsupported', reason: 'native importers disabled in this release' });
      return;
    }

    const hasDOMParser = (typeof DOMParser !== 'undefined');
    console.log(`[worker] DOMParser available: ${hasDOMParser}`);

    if (!hasDOMParser) {
      self.postMessage({ id, status: 'unsupported', reason: 'DOMParser not available in worker' });
      return;
    }

    let htmlInput = payload.html || '';
    let imageMap = (payload.config && payload.config.imageMap) || {};

    // If filename indicates MHT/MHTML, attempt to parse it here in the worker
    if (sourceKind === 'mht') {
      console.log('[worker] detected MHT input, attempting parseMht in worker');
      if (typeof _parseMht !== 'function') {
        console.warn('[worker] parseMht not available in worker (module not loaded)');
      } else {
        const parsed = _parseMht(htmlInput);
        if (parsed && parsed.html) {
          htmlInput = parsed.html;
          imageMap = Object.assign({}, imageMap, parsed.imageMap || {});
          console.log(`[worker] parseMht: html length=${htmlInput.length} parts=${parsed.parts.length} boundary=${parsed.boundary}`);
        } else {
          console.warn('[worker] parseMht did not return HTML; continuing with original payload.html');
        }
      }
    }

    self.postMessage({ id, status: 'progress', step: 'start', percent: 0 });
    if (typeof _runPipeline !== 'function') {
      const msg = 'pipeline not available in worker';
      console.error('[worker] ' + msg);
      try { postDiagnostic({ id: 'init', status: 'error', phase: 'init', msg, meta: { note: 'pipeline missing' } }); } catch (ignore) {}
      self.postMessage({ id, status: 'error', error: msg });
      return;
    }
    const result = await _runPipeline(htmlInput, Object.assign({}, payload.config || {}, {
      imageMap,
      SourceName: fileName,
      SourceKind: sourceKind
    }));
    console.log(`[worker] job ${id} done, output length=${String((result.output || '').length)}`);
    self.postMessage({
      id,
      status: 'done',
      outputHtml: result.output,
      relativePath: payload.relativePath || payload.fileName,
      logs: result.logs || []
    });
  } catch (err) {
    console.error(`[worker] job ${id} error:`, err);
    try { postDiagnostic({ id, status: 'error', phase: 'job', msg: String(err && err.message ? err.message : String(err)), meta: { stack: err && err.stack } }); } catch (ignore) {}
    self.postMessage({ id, status: 'error', error: String(err) });
  }
};
