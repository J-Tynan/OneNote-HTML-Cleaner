// Minimal, non-throwing structured logger for browser + test environments.
// Keep this file tiny and dependency-free; use `preview` for large payloads.
// The logger can be globally enabled/disabled via `setEnabled()` or by
// setting `process.env.LOGGING_ENABLED` (not 'false') in Node/tests. A
// disabled logger becomes a no-op to avoid noise in production or tests.

let _enabled = true;

export function setEnabled(val) {
  _enabled = !!val;
}

const MAX_PREVIEW_LENGTH = 160;

function nowIso() {
  return new Date().toISOString();
}

function safeStringify(value, maxLen = MAX_PREVIEW_LENGTH) {
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
  } catch (err) {
    try {
      return String(value).slice(0, maxLen);
    } catch (__) {
      return '<unserializable>';
    }
  }
}

function formatPrefix(source, level, ts, id) {
  return `[${source}] ${level.toUpperCase()} ${ts}${id ? ` id=${id}` : ''}`;
}

export function log(source = 'app', level = 'info', { id, type, msg = '', meta, preview } = {}) {
  if (!_enabled) return;
  try {
    const ts = nowIso();
    const safePreview = preview ?? (meta ? safeStringify(meta) : undefined);
    const prefix = formatPrefix(source, level, ts, id);
    const consoleMsg = `${prefix} — ${msg}${safePreview ? ' — ' + safePreview : ''}`;
    const payload = { ts, source, level, id, type, msg, meta, preview: safePreview };

    const printer = (console && console[level]) || console.log;
    try {
      printer.call(console, consoleMsg, payload);
    } catch (e) {
      // Fallback if console.* is not callable in some environment
      console.log(consoleMsg, payload);
    }
  } catch (err) {
    // Never throw from the logger itself.
    try { console.error('[logging] failed', err && err.stack ? err.stack : err); } catch (_) {}
  }
}

export const info = (source, payload) => log(source, 'info', payload);
export const warn = (source, payload) => log(source, 'warn', payload);
export const error = (source, payload) => log(source, 'error', payload);

// factory to create a logger instance bound to a specific source string
export function createLogger(source = 'app') {
  return {
    info: (payload) => info(source, payload),
    warn: (payload) => warn(source, payload),
    error: (payload) => error(source, payload),
    log: (level, payload) => log(source, level, payload)
  };
}

export default { log, info, warn, error, safeStringify, createLogger };
