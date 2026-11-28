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
  : 'onenote-cleaner-v4';

/** @type {string[]} */
const ASSETS = [
  './', 'index.html', 'manifest.json', 'styles.css',
  'assets/tailwind-app.css', 'assets/tailwind-output.css', 'assets/vendor/jszip.min.js',
  'src/app.js', 'src/export-filenames.js', 'src/logging.js', 'src/theme.js',
  'src/ui-downloads.js', 'src/ui-options.js', 'src/ui-output-records.js',
  'src/ui-workbench-model.js', 'src/ui-worker-payload.js', 'src/ui.js',
  'src/worker-globals.js', 'src/worker-wrapper.js', 'src/worker.js',
  'src/convert/exportFinalizer.js', 'src/convert/markdownCore.js',
  'src/convert/markdownFlavors.js', 'src/convert/markdownIr.js',
  'src/importers/one.js', 'src/importers/onePreflight.js',
  'src/importers/sourceKind.js', 'src/importers/warnings.js',
  'src/importers/one/binary-reader.js', 'src/importers/one/section-header.js',
  'src/pipeline/config.js', 'src/pipeline/dateTimeLayout.js', 'src/pipeline/format.js',
  'src/pipeline/images.js', 'src/pipeline/inlineStyleMigration.js',
  'src/pipeline/layoutNormalization.js', 'src/pipeline/listRepair.js',
  'src/pipeline/mht.js', 'src/pipeline/mhtPayloadPreparation.js',
  'src/pipeline/parser.js', 'src/pipeline/pipeline.js', 'src/pipeline/sanitize.js',
  'src/pipeline/Semantics.js', 'src/pipeline/styleUtils.js',
  'src/pipeline/toolbarInjector.js'
];

sw.addEventListener('install', (event) => {
  // do not call skipWaiting here — prefer a controlled activation via message or release automation
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(ASSETS.map((asset) => new URL(asset, sw.registration.scope).href))
  ));
});

sw.addEventListener('activate', (event) => {
  // remove old caches and take control of clients
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('onenote-cleaner-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event) => event.respondWith(
  caches.open(CACHE).then((cache) => cache.match(event.request)).then((response) => response || fetch(event.request))
));

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
