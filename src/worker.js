// src/worker.js
import { postDiagnostic } from './worker-globals.js';
import { detectSourceKind } from './importers/sourceKind.js';
// logging helper allows consistent formatting across UI, wrapper, and worker
import { createLogger, setEnabled as setLogEnabled } from './logging.js';
const logger = createLogger('worker');

// Module-level placeholders for lazy-loaded modules. These are initialized
// from `init()` so import-time evaluation of heavy modules is avoided.
let _runPipeline = null;
let _parseMht = null;
let _convertSanitizedHtmlToMarkdown = null;
let _importOneSection = null;
let _importOnePackage = null;

export async function init() {
  try {
    // Ensure logging is active inside worker; can be toggled via global
    // variable for testing or debug builds.
    try { setLogEnabled(typeof self !== 'undefined' && self && self.LOGGING_ENABLED !== false); } catch (_) {}
    const hasDOMParser = (typeof DOMParser !== 'undefined');
    logger.info({ msg: 'init()', meta: { hasDOMParser } });

    // Lazy-load heavy modules here so any import-time failures are
    // captured and posted as structured diagnostics (worker-globals).
    // Only load the MHT + pipeline modules during worker init for the
    // MHT-only release. Native `.one` / `.onepkg` importers are deferred
    // and will not be loaded at worker startup.
    const imports = await Promise.allSettled([
      import('./pipeline/pipeline.js'),
      import('./pipeline/mht.js'),
      import('./convert/markdownCore.js')
    ]);

    // Assign successful imports to module-scoped variables
    if (imports[0].status === 'fulfilled') _runPipeline = imports[0].value.runPipeline;
    if (imports[1].status === 'fulfilled') _parseMht = imports[1].value.parseMht;
    if (imports[2].status === 'fulfilled') _convertSanitizedHtmlToMarkdown = imports[2].value.convertSanitizedHtmlToMarkdown;

    // Report any import failures for diagnostics (but still post ready so
    // the wrapper can surface structured diagnostics to the UI).
    const failed = imports
      .map((r, i) => ({ idx: i, status: r.status, reason: r.status === 'rejected' ? String(r.reason) : undefined }))
      .filter((r) => r.status === 'rejected');
    if (failed.length) {
      logger.warn({ msg: 'imports failed during init()', meta: { failed } });
      try {
        postDiagnostic({ id: 'init', status: 'error', phase: 'init-imports', msg: 'imports failed during init', meta: { failed } });
      } catch (ignore) { /* swallow */ }
    }

    // Post explicit ready handshake after init completes.
    self.postMessage({ type: 'ready', id: 'init', timestamp: Date.now(), hasDOMParser });
    logger.info({ msg: 'posted ready', meta: { hasDOMParser } });
  } catch (err) {
    logger.error({ msg: 'init() error', meta: { error: String(err && err.message ? err.message : String(err)), stack: err && err.stack } });
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
    logger.info({ msg: 'received init message from wrapper' });
    try {
      await init(payload.options || {});
    } catch (err) {
      logger.error({ msg: 'init() failed after init message', meta: { error: String(err && err.message ? err.message : String(err)), stack: err && err.stack } });
    }
    return; // init message handled
  }
  // Worker must always receive an id from the wrapper. If the payload is
  // missing an id we record a diagnostic and drop the message rather than
  // inventing a new one (which would cause an unmatched-message in the
  // wrapper). This guards against callers accidentally forgetting to assign
  // ids and surfaces it during testing.
  if (!payload || typeof payload.id !== 'string') {
    const errMsg = 'payload.id missing or invalid in onmessage';
    logger.error({ msg: errMsg, meta: { received: payload } });
    try {
      postDiagnostic({
        id: 'init',
        status: 'error',
        phase: 'message',
        msg: errMsg,
        meta: { received: payload }
      });
    } catch (ignore) {}
    return;
  }
  const id = payload.id;
  const fileName = payload.fileName || payload.relativePath || 'unknown';
  const sourceKind = payload.sourceKind || detectSourceKind(fileName, payload.mimetype);
  const config = payload && payload.config ? payload.config : {};
  const experimentalEnabled = config && config.ExperimentalExportEnabled === true;
  const exportFormat = experimentalEnabled ? String(config.ExportFormat || 'html').toLowerCase() : 'html';
  const markdownFlavor = String(config.MarkdownFlavor || 'obsidian');

  logger.info({ id, msg: 'received job', meta: { fileName } });

  try {
    // Native `.one` / `.onepkg` flows are out of scope for the current
    // (MHT-only) release — explicitly mark them unsupported so the UI can
    // surface the correct message and we avoid loading native importers.
    if (sourceKind === 'one' || sourceKind === 'onepkg') {
      logger.warn({ id, msg: 'native importers disabled', meta: { sourceKind } });
      self.postMessage({ id, status: 'unsupported', reason: 'native importers disabled in this release' });
      return;
    }

    if (exportFormat === 'docx') {
      self.postMessage({ id, status: 'error', error: 'Experimental export format "docx" is not implemented yet.' });
      return;
    }

    const hasDOMParser = (typeof DOMParser !== 'undefined');
    logger.info({ id, msg: 'DOMParser availability', meta: { hasDOMParser } });

    if (!hasDOMParser) {
      self.postMessage({ id, status: 'unsupported', reason: 'DOMParser not available in worker' });
      return;
    }

    let htmlInput = payload.html || '';
    let imageMap = (payload.config && payload.config.imageMap) || {};
    let parseWarnings = [];

    // If filename indicates MHT/MHTML, attempt to parse it here in the worker
    if (sourceKind === 'mht') {
      logger.info({ id, msg: 'detected MHT input, attempting parseMht' });
      if (typeof _parseMht !== 'function') {
        logger.warn({ id, msg: 'parseMht not available (module not loaded)' });
      } else {
        // enable charset logging if requested by the caller (test harness)
        if (payload && payload.debug && payload.debug.mhtCharsetLogging) {
          try { globalThis.MHT_CHARSET_LOG = true; } catch {};
        }
        const parsed = _parseMht(htmlInput, payload.config || {});
        if (parsed && parsed.html) {
          htmlInput = parsed.html;
          imageMap = Object.assign({}, imageMap, parsed.imageMap || {});
          if (Array.isArray(parsed.imageDiagnostics) && parsed.imageDiagnostics.length) {
            parseWarnings = parseWarnings.concat(parsed.imageDiagnostics);
          }
          logger.info({ id, msg: 'parseMht result', meta: { htmlLength: htmlInput.length, parts: parsed.parts.length, boundary: parsed.boundary } });
        } else {
          logger.warn({ id, msg: 'parseMht did not return HTML; proceeding with original payload.html' });
        }
      }
    }

    self.postMessage({ id, status: 'progress', step: 'start', percent: 0 });
    if (typeof _runPipeline !== 'function') {
      const msg = 'pipeline not available in worker';
      logger.error({ id, msg, meta: { note: 'pipeline not available' } });
      try { postDiagnostic({ id: 'init', status: 'error', phase: 'init', msg, meta: { note: 'pipeline missing' } }); } catch (ignore) {}
      self.postMessage({ id, status: 'error', error: msg });
      return;
    }
    const result = await _runPipeline(htmlInput, Object.assign({}, config, {
      imageMap,
      ParseWarnings: parseWarnings,
      SourceName: fileName,
      SourceKind: sourceKind
    }));

    if (exportFormat === 'markdown') {
      if (typeof _convertSanitizedHtmlToMarkdown !== 'function') {
        self.postMessage({ id, status: 'error', error: 'Markdown converter is not available in worker.' });
        return;
      }
      const outputMarkdown = _convertSanitizedHtmlToMarkdown(result.output || '', {
        flavor: markdownFlavor
      });
      logger.info({ id, msg: 'job done (markdown)', meta: { outputLength: String(outputMarkdown.length), flavor: markdownFlavor } });
      self.postMessage({
        id,
        status: 'done',
        outputText: outputMarkdown,
        outputFormat: 'markdown',
        outputAssets: [],
        relativePath: payload.relativePath || payload.fileName,
        logs: result.logs || []
      });
      return;
    }

    logger.info({ id, msg: 'job done (html)', meta: { outputLength: String((result.output || '').length) } });
    self.postMessage({
      id,
      status: 'done',
      outputHtml: result.output,
      outputFormat: 'html',
      outputAssets: Array.isArray(result.assets) ? result.assets : [],
      relativePath: payload.relativePath || payload.fileName,
      logs: result.logs || []
    });
  } catch (err) {
    logger.error({ id, msg: 'job error', meta: { error: String(err && err.message ? err.message : String(err)), stack: err && err.stack } });
    try { postDiagnostic({ id, status: 'error', phase: 'job', msg: String(err && err.message ? err.message : String(err)), meta: { stack: err && err.stack } }); } catch (ignore) {}
    self.postMessage({ id, status: 'error', error: String(err) });
  }
};
