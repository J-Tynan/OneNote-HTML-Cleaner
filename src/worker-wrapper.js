// @ts-check
// src/worker-wrapper.js
import { createLogger, setEnabled as setLogEnabled } from './logging.js';
import { preparePipelineInputFromPayload } from './pipeline/mhtPayloadPreparation.js';
const logger = createLogger('worker-wrapper');

/**
 * @typedef {import('./contracts.js').ImageMap} ImageMap
 * @typedef {import('./contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {import('./contracts.js').PipelineLogEntry} PipelineLogEntry
 * @typedef {import('./contracts.js').PipelineResult} PipelineResult
 * @typedef {import('./contracts.js').SourceKind} SourceKind
 * @typedef {import('./contracts.js').WorkerDiagnosticMessage} WorkerDiagnosticMessage
 * @typedef {import('./contracts.js').WorkerErrorResponse} WorkerErrorResponse
 * @typedef {import('./contracts.js').WorkerHtmlDoneResponse} WorkerHtmlDoneResponse
 * @typedef {import('./contracts.js').WorkerMarkdownDoneResponse} WorkerMarkdownDoneResponse
 * @typedef {import('./contracts.js').WorkerNativeDoneResponse} WorkerNativeDoneResponse
 * @typedef {import('./contracts.js').WorkerProgressMessage} WorkerProgressMessage
 * @typedef {import('./contracts.js').WorkerReadyMessage} WorkerReadyMessage
 * @typedef {import('./contracts.js').WorkerUnsupportedResponse} WorkerUnsupportedResponse
 * @typedef {WorkerHtmlDoneResponse | WorkerMarkdownDoneResponse | WorkerNativeDoneResponse} WorkerDoneResponse
 * @typedef {WorkerDoneResponse | WorkerErrorResponse | WorkerUnsupportedResponse} WorkerTerminalResponse
 * @typedef {Partial<WorkerDiagnosticMessage> & { [key: string]: unknown }} WorkerDiagnosticInput
 * @typedef {WorkerDiagnosticMessage & { [key: string]: unknown }} WorkerDiagnosticRecord
 * @typedef {{ id?: string, type?: string, status?: string, fileName?: string, relativePath?: string, outputHtml?: string, outputText?: string, outputFormat?: string, code?: string, reason?: string, source?: string, [key: string]: unknown }} WorkerMessage
 * @typedef {{ id?: string, fileName?: string, relativePath?: string, mimetype?: string, sourceKind?: SourceKind, html?: string, bytes?: ArrayBuffer, config?: PipelineConfigInput, [key: string]: unknown }} WorkerPayload
 * @typedef {{ handshakeTimeoutMs?: number, defaultTimeoutMs?: number, maxPendingCallbacks?: number, recentlyHandledTtlMs?: number }} WorkerManagerOptions
 * @typedef {{ payload: WorkerPayload & { id: string }, transferList: Transferable[] }} PendingQueueEntry
 * @typedef {{ resolve: (value: WorkerDoneResponse) => void, reject: (reason: WorkerErrorResponse | WorkerUnsupportedResponse) => void, onprogress?: ((message: WorkerProgressMessage) => void) | null, payload: WorkerPayload & { id: string }, timeoutHandle: number }} WorkerCallbackRecord
 * @typedef {{ attempted: boolean, parseAvailable: boolean, parsed: boolean, partsCount: number, boundary: string | null }} MhtPreparation
 * @typedef {{ html?: string | null, imageMap?: ImageMap, imageDiagnostics?: PipelineLogEntry[], parts?: unknown[], boundary?: string | null }} MhtParseResult
 * @typedef {(rawText: string, options?: PipelineConfigInput) => MhtParseResult} ParseMhtFn
 * @typedef {(htmlString: string, config?: PipelineConfigInput) => Promise<PipelineResult>} RunPipelineFn
 * @typedef {(options: { id: string, payload: WorkerPayload, result: PipelineResult }) => WorkerDoneResponse} FinalizePipelineOutputFn
 * @typedef {(options: { payload: WorkerPayload, parseMht: ParseMhtFn | null }) => { fileName: string, sourceKind: SourceKind, htmlInput: string, imageMap: ImageMap, parseWarnings: PipelineLogEntry[], mhtPreparation: MhtPreparation }} PreparePipelineInputFromPayloadFn
 */

/** @type {PreparePipelineInputFromPayloadFn} */
const preparePayloadForPipeline = preparePipelineInputFromPayload;

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function errorMessage(error) {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : String(error);
}

const UNSUPPORTED_FALLBACK_CODES = new Set([
  'worker-dom-unavailable'
]);

const HANDSHAKE_TIMEOUT_MS = 5000;
const JOB_TIMEOUT_MS = 120000;
const RECENTLY_HANDLED_TTL_MS = 30000;
const MAX_PENDING_CALLBACKS = 1000;

export default class WorkerManager {
  /**
   * @param {string} [workerPath]
   * @param {WorkerManagerOptions} [options]
   */
  constructor(workerPath = './worker.js', options = {}) {
    try {
      const appWindow = /** @type {Window & typeof globalThis & { LOGGING_ENABLED?: boolean }} */ (window);
      setLogEnabled(typeof window !== 'undefined' && appWindow && appWindow.LOGGING_ENABLED !== false);
    } catch (_) {}
    // Resolve worker script relative to this module so it works on GitHub Pages subpaths
    const resolved = new URL(workerPath, import.meta.url).href;
    logger.info({ msg: 'creating worker from', meta: { resolved } });
    try {
      this.worker = new Worker(resolved, { type: 'module' });
    } catch (err) {
      logger.error({ msg: 'failed to construct Worker', meta: { resolved, error: errorMessage(err) } });
      throw err;
    }

    // Handshake / buffering state
    this.ready = false; // becomes true when worker posts { type: 'ready' }
  /** @type {PendingQueueEntry[]} */
    this.pendingQueue = []; // queued payloads while worker initializes
    // Release-path guardrail: a worker that cannot handshake within 5 seconds
    // is treated as broken so queued conversions fail deterministically.
    this.handshakeTimeoutMs = isFiniteNumber(options.handshakeTimeoutMs)
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

    /** @type {number | null} */
    this._handshakeTimer = setTimeout(this._onHandshakeTimeout, this.handshakeTimeoutMs);

    /** @type {Map<string, WorkerCallbackRecord>} */
    this.callbacks = new Map();
    // map wrapperId -> original caller id (may be null)
    /** @type {Map<string, string | null>} */
    this._wrapperToOriginal = new Map();
    // set of recently handled wrapperIds (for duplicate-response detection)
    /** @type {Set<string>} */
    this._recentlyHandled = new Set();
    // Release-path guardrail: allow long conversions, but bound hung jobs.
    this.defaultTimeoutMs = isFiniteNumber(options.defaultTimeoutMs)
      ? Math.max(0, options.defaultTimeoutMs)
      : JOB_TIMEOUT_MS;

    // In-memory diagnostics buffer (capped) for unmatched messages / worker diagnostics
    /** @type {WorkerDiagnosticRecord[]} */
    this.diagnostics = [];
    this._diagnosticsMax = 50;

    // configuration
    // Release-path guardrail: cap unresolved callbacks to avoid unbounded growth
    // if the UI or worker starts queueing jobs faster than they complete.
    this.maxPendingCallbacks = isFiniteNumber(options.maxPendingCallbacks)
      ? Math.max(1, options.maxPendingCallbacks)
      : MAX_PENDING_CALLBACKS;
    this.recentlyHandledTtlMs = isFiniteNumber(options.recentlyHandledTtlMs)
      ? Math.max(0, options.recentlyHandledTtlMs)
      : RECENTLY_HANDLED_TTL_MS;

    /**
     * @param {string} reason
     * @returns {void}
     */
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
          if (!q) break;
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

      const messageId = typeof msg.id === 'string' ? msg.id : '';
      const cb = messageId ? this.callbacks.get(messageId) : undefined;

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
        if (messageId && this._recentlyHandled.has(messageId)) {
          // record duplicate-response diagnostic
          const dup = this._createDiagnostic({
            kind: 'duplicate-response',
            id: messageId,
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
            id: messageId || undefined,
            status: msg && (msg.status || msg.type),
            size: typeof msg.outputHtml === 'string' ? String(msg.outputHtml.length) : undefined,
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
        const doneMessage = /** @type {WorkerDoneResponse} */ (/** @type {unknown} */ (msg));
        this._attachOriginalId(doneMessage);
        cb.resolve(doneMessage);
        this.callbacks.delete(messageId);
        this._markHandled(messageId);
      } else if (msg.status === 'error') {
        const errorMessageResponse = /** @type {WorkerErrorResponse} */ (/** @type {unknown} */ (msg));
        this._attachOriginalId(errorMessageResponse);
        cb.reject(errorMessageResponse);
        this.callbacks.delete(messageId);
        this._markHandled(messageId);
      } else if (msg.status === 'progress' && cb.onprogress) {
        cb.onprogress(/** @type {WorkerProgressMessage} */ (/** @type {unknown} */ (msg)));
      } else if (msg.status === 'unsupported') {
        const unsupportedMessage = /** @type {WorkerUnsupportedResponse} */ (/** @type {unknown} */ (msg));
        if (!this.canFallbackFromUnsupported(msg)) {
          this._attachOriginalId(unsupportedMessage);
          cb.reject(unsupportedMessage);
          this.callbacks.delete(messageId);
          this._markHandled(messageId);
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
          const parseMht = /** @type {ParseMhtFn} */ (mhtMod.parseMht);
          const {
            fileName,
            sourceKind,
            htmlInput,
            imageMap,
            parseWarnings,
            mhtPreparation
          } = preparePayloadForPipeline({
            payload,
            parseMht
          });

          if (mhtPreparation.attempted) {
            logger.info({ msg: 'main-thread parseMht for', meta: { fileName } });
            if (mhtPreparation.parsed) {
              logger.info({ msg: 'parseMht produced html length', meta: { htmlLength: htmlInput.length } });
            } else {
              logger.warn({ msg: 'parseMht returned no HTML; proceeding with original payload.html' });
            }
          }
          const runPipeline = /** @type {RunPipelineFn} */ (pipelineMod.runPipeline);
          const result = await runPipeline(htmlInput, Object.assign({}, payload.config || {}, {
            imageMap,
            ParseWarnings: parseWarnings,
            SourceName: fileName || payload.relativePath || 'Converted file',
            SourceKind: sourceKind
          }));
          const finalizePipelineOutput = /** @type {FinalizePipelineOutputFn} */ (exportFinalizerMod.finalizePipelineOutput);
          const response = finalizePipelineOutput({ id: messageId, payload, result });
          // preserve original id mapping if available
          this._attachOriginalId(response);
          cb.resolve(response);
        } catch (err) {
          /** @type {WorkerErrorResponse} */
          const errorObj = { id: messageId, status: 'error', error: String(err) };
          this._attachOriginalId(errorObj);
          cb.reject(errorObj);
        } finally {
          this.callbacks.delete(messageId);
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
      logger.warn({ msg: 'failed to send init message', meta: { error: errorMessage(err) } });
    }
  }

  // Validate incoming messages from the worker. This helps catch
  // malformed payloads early and prevents runtime exceptions or
  // mis-routed callbacks. If a message is invalid a diagnostic is stored
  // and the function returns false so the caller can bail out.
  /**
   * @param {WorkerDiagnosticInput} [detail]
   * @returns {WorkerDiagnosticRecord}
   */
  _createDiagnostic(detail = {}) {
    const diag = Object.assign({}, detail);
    diag.timestamp = diag.timestamp || Date.now();
    diag.source = diag.source || 'wrapper';
    diag.workerUrl = diag.workerUrl || this.workerUrl;
    if (!diag.type) {
      diag.type = '__diag__';
    }
    return /** @type {WorkerDiagnosticRecord} */ (diag);
  }

  /**
   * @param {WorkerDiagnosticRecord} diag
   * @returns {void}
   */
  _dispatchDiagnostic(diag) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
      return;
    }
    window.dispatchEvent(new CustomEvent('worker-diagnostic', { detail: diag }));
  }

  // push a diagnostic into the capped buffer and emit the DOM event once.
  /**
   * @param {WorkerDiagnosticInput | WorkerDiagnosticRecord | null | undefined} diag
   * @returns {void}
   */
  _pushDiagnostic(diag) {
    try {
      if (!diag || typeof diag !== 'object') return;
      const normalized = this._createDiagnostic(diag);
      this.diagnostics.push(normalized);
      if (this.diagnostics.length > this._diagnosticsMax) this.diagnostics.shift();
      this._dispatchDiagnostic(normalized);
    } catch (ignore) {}
  }

  /**
   * @param {WorkerTerminalResponse} message
   * @returns {WorkerTerminalResponse}
   */
  _attachOriginalId(message) {
    if (!message || !message.id || !this._wrapperToOriginal.has(message.id)) {
      return message;
    }
    message.originalId = this._wrapperToOriginal.get(message.id);
    this._wrapperToOriginal.delete(message.id);
    return message;
  }

  /**
   * @param {string | undefined} id
   * @returns {void}
   */
  _markHandled(id) {
    if (!id) return;
    this._recentlyHandled.add(id);
    setTimeout(() => this._recentlyHandled.delete(id), this.recentlyHandledTtlMs);
  }

  /**
   * @param {unknown} msg
   * @returns {msg is WorkerMessage}
   */
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
    const message = /** @type {WorkerMessage} */ (msg);
    // diagnostics messages are allowed to omit id
    if (message.type === '__diag__' || message.id === '__diag__') return true;
    if (!message.id || typeof message.id !== 'string') {
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
  /**
   * @param {WorkerMessage | WorkerPayload | null | undefined} payload
   * @param {number} [maxChars]
   * @returns {string}
   */
  summarizePayload(payload, maxChars = 256) {
    try {
      if (!payload) return '';
      const parts = [];
      if (payload.type) parts.push(`type=${payload.type}`);
      if (payload.fileName) parts.push(`file=${payload.fileName}`);
      else if (payload.relativePath) parts.push(`file=${payload.relativePath}`);
      if (payload.status) parts.push(`status=${payload.status}`);
      if (typeof payload.outputHtml === 'string') parts.push(`outputLen=${payload.outputHtml.length}`);
      const s = parts.join('; ');
      return s.length > maxChars ? s.slice(0, maxChars) + '…' : s;
    } catch (e) {
      return '';
    }
  }

  // Expose recent diagnostics captured from worker/unmatched messages
  /**
   * @returns {WorkerDiagnosticRecord[]}
   */
  getDiagnostics() {
    return this.diagnostics.slice();
  }

  // number of currently unresolved callbacks
  /**
   * @returns {number}
   */
  getPendingCount() {
    return this.callbacks.size;
  }

  /**
   * @param {WorkerUnsupportedResponse | WorkerMessage | null | undefined} msg
   * @returns {boolean}
   */
  canFallbackFromUnsupported(msg) {
    if (!msg || typeof msg !== 'object') return false;
    if (msg.code && UNSUPPORTED_FALLBACK_CODES.has(msg.code)) return true;
    return msg.reason === 'DOMParser not available in worker';
  }

  /**
   * @param {WorkerPayload | null | undefined} payload
   * @param {((message: WorkerProgressMessage) => void) | null} [onprogress]
   * @param {Transferable[]} [transferList]
   * @param {number} [timeoutMs]
   * @returns {Promise<WorkerDoneResponse>}
   */
  enqueue(payload, onprogress = null, transferList = [], timeoutMs = this.defaultTimeoutMs) {
    // Wrapper now always assigns its own authoritative ID. If the caller
    // supplied one we remember it so we can echo it back later.
    let clientId = null;
    const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
    if (normalizedPayload.id && typeof normalizedPayload.id === 'string') {
      clientId = normalizedPayload.id;
    }
    // generate wrapper ID
    let wrapperId;
    try {
      wrapperId = crypto.randomUUID();
    } catch (e) {
      wrapperId = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
    }
    normalizedPayload.id = wrapperId;
    this._wrapperToOriginal.set(wrapperId, clientId);
    const queuedPayload = /** @type {WorkerPayload & { id: string }} */ (normalizedPayload);

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
        const active = this.callbacks.get(wrapperId);
        if (!active) return;
        this.callbacks.delete(wrapperId);
        reject({ id: wrapperId, status: 'error', error: `Worker timeout after ${timeoutMs}ms` });
      }, timeoutMs);

      this.callbacks.set(wrapperId, { resolve, reject, onprogress, payload: queuedPayload, timeoutHandle });

      // If the worker hasn't finished its handshake yet, queue the payload
      if (!this.ready) {
        logger.info({ id: wrapperId, msg: 'worker not ready — queueing payload' });
        this.pendingQueue.push({ payload: queuedPayload, transferList });
        return;
      }

      try {
        logger.info({ id: wrapperId, msg: 'posting message to worker', meta: { file: queuedPayload.fileName || queuedPayload.relativePath } });
        this.worker.postMessage(queuedPayload, transferList);
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.callbacks.delete(wrapperId);
        reject({ id: wrapperId, status: 'error', error: String(error) });
      }
    });
  }
}
