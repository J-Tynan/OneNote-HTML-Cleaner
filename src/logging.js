// @ts-check
// Minimal, non-throwing structured logger for browser + test environments.
// Keep this file tiny and dependency-free; use `preview` for large payloads.
// The logger can be globally enabled/disabled via `setEnabled()` or by
// setting `process.env.LOGGING_ENABLED` (not 'false') in Node/tests. A
// disabled logger becomes a no-op to avoid noise in production or tests.

/**
 * @typedef {import('./contracts.js').LogLevel} LogLevel
 * @typedef {import('./contracts.js').LoggerPayload} LoggerPayload
 * @typedef {{ ts: string, source: string, level: LogLevel, id?: string, type?: string, msg: string, meta?: unknown, preview?: string }} LoggerConsolePayload
 * @typedef {{ info: (payload?: LoggerPayload) => void, warn: (payload?: LoggerPayload) => void, error: (payload?: LoggerPayload) => void, log: (level: LogLevel, payload?: LoggerPayload) => void }} BoundLogger
 */

let _enabled = true;

/**
 * @param {unknown} val
 * @returns {void}
 */
export function setEnabled(val) {
  _enabled = !!val;
}

const MAX_PREVIEW_LENGTH = 160;

/**
 * @returns {string}
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {unknown} value
 * @param {number} [maxLen]
 * @returns {string}
 */
function safeStringify(value, maxLen = MAX_PREVIEW_LENGTH) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const s = typeof serialized === 'string' ? serialized : String(serialized);
    return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
  } catch (err) {
    try {
      return String(value).slice(0, maxLen);
    } catch (__) {
      return '<unserializable>';
    }
  }
}

/**
 * @param {string} source
 * @param {LogLevel} level
 * @param {string} ts
 * @param {string | undefined} id
 * @returns {string}
 */
function formatPrefix(source, level, ts, id) {
  return `[${source}] ${level.toUpperCase()} ${ts}${id ? ` id=${id}` : ''}`;
}

/**
 * @param {unknown} error
 * @returns {unknown}
 */
function errorStackOrValue(error) {
  return error && typeof error === 'object' && 'stack' in error ? error.stack : error;
}

/**
 * @param {string} [source]
 * @param {LogLevel} [level]
 * @param {LoggerPayload} [payload]
 * @returns {void}
 */
export function log(source = 'app', level = 'info', { id, type, msg = '', meta, preview } = {}) {
  if (!_enabled) return;
  try {
    const ts = nowIso();
    const safePreview = preview ?? (meta ? safeStringify(meta) : undefined);
    const prefix = formatPrefix(source, level, ts, id);
    const consoleMsg = `${prefix} — ${msg}${safePreview ? ' — ' + safePreview : ''}`;
    /** @type {LoggerConsolePayload} */
    const payload = { ts, source, level, id, type, msg, meta, preview: safePreview };

    const printer = (level === 'debug' ? console.debug : level === 'info' ? console.info : level === 'warn' || level === 'warning' ? console.warn : console.error) || console.log;
    try {
      printer.call(console, consoleMsg, payload);
    } catch (e) {
      // Fallback if console.* is not callable in some environment
      console.log(consoleMsg, payload);
    }
  } catch (err) {
    // Never throw from the logger itself.
    try { console.error('[logging] failed', errorStackOrValue(err)); } catch (_) {}
  }
}

/**
 * @param {string} source
 * @param {LoggerPayload} [payload]
 * @returns {void}
 */
export const info = (source, payload) => log(source, 'info', payload);
/**
 * @param {string} source
 * @param {LoggerPayload} [payload]
 * @returns {void}
 */
export const warn = (source, payload) => log(source, 'warn', payload);
/**
 * @param {string} source
 * @param {LoggerPayload} [payload]
 * @returns {void}
 */
export const error = (source, payload) => log(source, 'error', payload);

// factory to create a logger instance bound to a specific source string
/**
 * @param {string} [source]
 * @returns {BoundLogger}
 */
export function createLogger(source = 'app') {
  return {
    info: (payload) => info(source, payload),
    warn: (payload) => warn(source, payload),
    error: (payload) => error(source, payload),
    log: (level, payload) => log(source, level, payload)
  };
}

export default { log, info, warn, error, safeStringify, createLogger };
