// @ts-check
// src/worker.js
import { postDiagnostic } from './worker-globals.js';
import { detectSourceKind } from './importers/sourceKind.js';
import { preparePipelineInputFromPayload } from './pipeline/mhtPayloadPreparation.js';
// logging helper allows consistent formatting across UI, wrapper, and worker
import { createLogger, setEnabled as setLogEnabled } from './logging.js';
const logger = createLogger('worker');

/**
 * @typedef {import('./contracts.js').ImageMap} ImageMap
 * @typedef {import('./contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {import('./contracts.js').PipelineLogEntry} PipelineLogEntry
 * @typedef {import('./contracts.js').PipelineResult} PipelineResult
 * @typedef {import('./contracts.js').SourceKind} SourceKind
 * @typedef {import('./contracts.js').UnsupportedCode} UnsupportedCode
 * @typedef {import('./contracts.js').WorkerErrorResponse} WorkerErrorResponse
 * @typedef {import('./contracts.js').WorkerHtmlDoneResponse} WorkerHtmlDoneResponse
 * @typedef {import('./contracts.js').WorkerInitRequest} WorkerInitRequest
 * @typedef {import('./contracts.js').WorkerMarkdownDoneResponse} WorkerMarkdownDoneResponse
 * @typedef {import('./contracts.js').WorkerProgressMessage} WorkerProgressMessage
 * @typedef {import('./contracts.js').WorkerReadyMessage} WorkerReadyMessage
 * @typedef {import('./contracts.js').WorkerUnsupportedResponse} WorkerUnsupportedResponse
 * @typedef {{ html?: string | null, imageMap?: ImageMap, imageDiagnostics?: PipelineLogEntry[], parts?: unknown[], boundary?: string | null }} MhtParseResult
 * @typedef {{ attempted: boolean, parseAvailable: boolean, parsed: boolean, partsCount: number, boundary: string | null }} MhtPreparation
 * @typedef {(rawText: string, options?: PipelineConfigInput) => MhtParseResult} ParseMhtFn
 * @typedef {(htmlString: string, config?: PipelineConfigInput) => Promise<PipelineResult>} RunPipelineFn
 * @typedef {(options: { id: string, payload: WorkerRuntimePayload, result: PipelineResult }) => WorkerHtmlDoneResponse | WorkerMarkdownDoneResponse} FinalizePipelineOutputFn
 * @typedef {{ id?: string, type?: string, fileName?: string, relativePath?: string, mimetype?: string, sourceKind?: SourceKind, html?: string, bytes?: ArrayBuffer, config?: PipelineConfigInput, debug?: { mhtCharsetLogging?: boolean } }} WorkerRuntimePayload
 * @typedef {Partial<WorkerInitRequest> & WorkerRuntimePayload} WorkerIncomingPayload
 * @typedef {(options: { payload: WorkerRuntimePayload, parseMht: ParseMhtFn | null, enableCharsetLogging?: () => void }) => { fileName: string, sourceKind: SourceKind, htmlInput: string, imageMap: ImageMap, parseWarnings: PipelineLogEntry[], mhtPreparation: MhtPreparation }} PreparePipelineInputFromPayloadFn
 */

/** @type {typeof globalThis & { DOMParser?: unknown, LOGGING_ENABLED?: boolean, MHT_CHARSET_LOG?: boolean }} */
const workerGlobal = globalThis;
/** @type {PreparePipelineInputFromPayloadFn} */
const preparePayloadForPipeline = preparePipelineInputFromPayload;

/**
 * @param {unknown} error
 * @returns {string}
 */
function errorMessage(error) {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : String(error);
}

/**
 * @param {unknown} error
 * @returns {string | undefined}
 */
function errorStack(error) {
  return error && typeof error === 'object' && 'stack' in error
    ? String(error.stack)
    : undefined;
}

// Module-level placeholders for lazy-loaded modules. These are initialized
// from `init()` so import-time evaluation of heavy modules is avoided.
/** @type {RunPipelineFn | null} */
let _runPipeline = null;
/** @type {ParseMhtFn | null} */
let _parseMht = null;
/** @type {FinalizePipelineOutputFn | null} */
let _finalizePipelineOutput = null;
let _importOneSection = null;
let _importOnePackage = null;

/** @satisfies {Record<string, UnsupportedCode>} */
const UNSUPPORTED_CODES = {
  NATIVE_DISABLED: 'native-disabled',
  WORKER_DOM_UNAVAILABLE: 'worker-dom-unavailable'
};

/**
 * @param {Record<string, unknown>} [_options]
 * @returns {Promise<void>}
 */
export async function init(_options = {}) {
  try {
    // Ensure logging is active inside worker; can be toggled via global
    // variable for testing or debug builds.
    try { setLogEnabled(workerGlobal.LOGGING_ENABLED !== false); } catch (_) {}
    const hasDOMParser = (typeof workerGlobal.DOMParser !== 'undefined');
    logger.info({ msg: 'init()', meta: { hasDOMParser } });

    // Lazy-load heavy modules here so any import-time failures are
    // captured and posted as structured diagnostics (worker-globals).
    // Only load the MHT + pipeline modules during worker init for the
    // MHT-only release. Native `.one` / `.onepkg` importers are deferred
    // and will not be loaded at worker startup.
    const imports = await Promise.allSettled([
      import('./pipeline/pipeline.js'),
      import('./pipeline/mht.js'),
      import('./convert/exportFinalizer.js')
    ]);

    // Assign successful imports to module-scoped variables
  if (imports[0].status === 'fulfilled') _runPipeline = /** @type {RunPipelineFn} */ (imports[0].value.runPipeline);
  if (imports[1].status === 'fulfilled') _parseMht = /** @type {ParseMhtFn} */ (imports[1].value.parseMht);
  if (imports[2].status === 'fulfilled') _finalizePipelineOutput = /** @type {FinalizePipelineOutputFn} */ (imports[2].value.finalizePipelineOutput);

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
  self.postMessage(/** @type {WorkerReadyMessage} */ ({ type: 'ready', id: 'init', timestamp: Date.now(), hasDOMParser }));
    logger.info({ msg: 'posted ready', meta: { hasDOMParser } });
  } catch (err) {
    logger.error({ msg: 'init() error', meta: { error: errorMessage(err), stack: errorStack(err) } });
    try {
      postDiagnostic({ id: 'init', status: 'error', phase: 'init', msg: errorMessage(err), meta: { stack: errorStack(err) } });
    } catch (ignore) {}
    throw err;
  }
}

// Do not auto-run `init()` at import time — the wrapper will explicitly
// request initialization with `{ type: 'init' }` so startup is deterministic.

self.onmessage = async (e) => {
  const payload = /** @type {WorkerIncomingPayload | null | undefined} */ (e.data);

  // Support explicit initialization request from the wrapper. This defers
  // dynamic imports until the wrapper posts `{ type: 'init' }`.
  if (payload && payload.type === 'init') {
    logger.info({ msg: 'received init message from wrapper' });
    try {
      await init(payload.options || {});
    } catch (err) {
      logger.error({ msg: 'init() failed after init message', meta: { error: errorMessage(err), stack: errorStack(err) } });
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
  const jobPayload = /** @type {WorkerRuntimePayload & { id: string }} */ (payload);
  const id = jobPayload.id;
  const fileName = jobPayload.fileName || jobPayload.relativePath || 'unknown';
  const sourceKind = payload.sourceKind || detectSourceKind(fileName, payload.mimetype);
  const config = jobPayload.config || {};

  logger.info({ id, msg: 'received job', meta: { fileName } });

  try {
    // Native `.one` / `.onepkg` flows are out of scope for the current
    // (MHT-only) release — explicitly mark them unsupported so the UI can
    // surface the correct message and we avoid loading native importers.
    if (sourceKind === 'one' || sourceKind === 'onepkg') {
      logger.warn({ id, msg: 'native importers disabled', meta: { sourceKind } });
      self.postMessage(/** @type {WorkerUnsupportedResponse} */ ({
        id,
        status: 'unsupported',
        code: UNSUPPORTED_CODES.NATIVE_DISABLED,
        reason: 'native importers disabled in this release'
      }));
      return;
    }

    const hasDOMParser = (typeof workerGlobal.DOMParser !== 'undefined');
    logger.info({ id, msg: 'DOMParser availability', meta: { hasDOMParser } });

    if (!hasDOMParser) {
      self.postMessage(/** @type {WorkerUnsupportedResponse} */ ({
        id,
        status: 'unsupported',
        code: UNSUPPORTED_CODES.WORKER_DOM_UNAVAILABLE,
        reason: 'DOMParser not available in worker'
      }));
      return;
    }

    const {
      htmlInput,
      imageMap,
      parseWarnings,
      mhtPreparation
    } = preparePayloadForPipeline({
      payload: jobPayload,
      parseMht: _parseMht,
      enableCharsetLogging: () => {
        try { workerGlobal.MHT_CHARSET_LOG = true; } catch (_) {}
      }
    });

    if (mhtPreparation.attempted) {
      logger.info({ id, msg: 'detected MHT input, attempting parseMht' });
      if (!mhtPreparation.parseAvailable) {
        logger.warn({ id, msg: 'parseMht not available (module not loaded)' });
      } else if (mhtPreparation.parsed) {
        logger.info({ id, msg: 'parseMht result', meta: { htmlLength: htmlInput.length, parts: mhtPreparation.partsCount, boundary: mhtPreparation.boundary } });
      } else {
        logger.warn({ id, msg: 'parseMht did not return HTML; proceeding with original payload.html' });
      }
    }

    self.postMessage(/** @type {WorkerProgressMessage} */ ({ id, status: 'progress', step: 'start', percent: 0 }));
    if (typeof _runPipeline !== 'function') {
      const msg = 'pipeline not available in worker';
      logger.error({ id, msg, meta: { note: 'pipeline not available' } });
      try { postDiagnostic({ id: 'init', status: 'error', phase: 'init', msg, meta: { note: 'pipeline missing' } }); } catch (ignore) {}
      self.postMessage(/** @type {WorkerErrorResponse} */ ({ id, status: 'error', error: msg }));
      return;
    }
    const result = await _runPipeline(htmlInput, Object.assign({}, config, {
      imageMap,
      ParseWarnings: parseWarnings,
      SourceName: fileName,
      SourceKind: sourceKind
    }));

    if (typeof _finalizePipelineOutput !== 'function') {
      self.postMessage(/** @type {WorkerErrorResponse} */ ({ id, status: 'error', error: 'Export finalizer is not available in worker.' }));
      return;
    }

    const response = _finalizePipelineOutput({ id, payload: jobPayload, result });

    if (response.outputFormat === 'markdown') {
      logger.info({ id, msg: 'job done (markdown)', meta: { outputLength: String((response.outputText || '').length) } });
    } else {
      logger.info({ id, msg: 'job done (html)', meta: { outputLength: String((response.outputHtml || '').length) } });
    }
    self.postMessage(response);

  } catch (err) {
    logger.error({ id, msg: 'job error', meta: { error: errorMessage(err), stack: errorStack(err) } });
    try { postDiagnostic({ id, status: 'error', phase: 'job', msg: errorMessage(err), meta: { stack: errorStack(err) } }); } catch (ignore) {}
    self.postMessage(/** @type {WorkerErrorResponse} */ ({ id, status: 'error', error: String(err) }));
  }
};
