// @ts-check

/**
 * @typedef {ServiceWorkerGlobalScope & typeof globalThis & { __SW_CACHE_NAME__?: string }} CacheNamedServiceWorkerGlobalScope
 */

/** @type {CacheNamedServiceWorkerGlobalScope} */
const sw = /** @type {CacheNamedServiceWorkerGlobalScope} */ (self);

/**
 * @param {unknown} value
 * @returns {value is { type: 'SKIP_WAITING' }}
 */
function isSkipWaitingMessage(value) {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === 'SKIP_WAITING';
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function formatError(error) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
}

// Single source-of-truth cache name — replace at build/release time if needed.
// Build/release automation can replace the literal token `__SW_CACHE_NAME__` with a new value.
const CACHE = typeof sw.__SW_CACHE_NAME__ === 'string' && sw.__SW_CACHE_NAME__
  ? sw.__SW_CACHE_NAME__
  : 'onenote-cleaner-v3';

// Include worker files in precache so clients update worker code during releases
/** @type {string[]} */
const ASSETS = ['/', '/index.html', '/styles.css', '/src/app.js', '/src/worker.js', '/src/worker-globals.js'];

sw.addEventListener('install', (event) => {
  // do not call skipWaiting here — prefer a controlled activation via message or release automation
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

sw.addEventListener('activate', (event) => {
  // remove old caches and take control of clients
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event) => event.respondWith(caches.match(event.request).then((response) => response || fetch(event.request))));

// Accept an explicit SKIP_WAITING message from pages (in‑app update control or release automation)
sw.addEventListener('message', (event) => {
  try {
    const data = event.data;
    if (!isSkipWaitingMessage(data)) return;
    // allow the waiting worker to immediately activate
    sw.skipWaiting();
  } catch (err) {
    // guard: message handling must never throw
    console.error('[service-worker] message handler error', formatError(err));
  }
});
