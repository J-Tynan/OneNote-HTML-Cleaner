// Single source-of-truth cache name — replace at build/release time if needed.
// Build/release automation can replace the literal token `__SW_CACHE_NAME__` with a new value.
const CACHE = (typeof __SW_CACHE_NAME__ !== 'undefined' && __SW_CACHE_NAME__) ? __SW_CACHE_NAME__ : 'onenote-cleaner-v2';

// Include worker files in precache so clients update worker code during releases
const ASSETS = ['/', '/index.html', '/styles.css', '/src/app.js', '/src/worker.js', '/src/worker-globals.js'];

self.addEventListener('install', e => {
  // do not call skipWaiting here — prefer a controlled activation via message or release automation
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  // remove old caches and take control of clients
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));

// Accept an explicit SKIP_WAITING message from pages (in‑app update control or release automation)
self.addEventListener('message', (event) => {
  try {
    const data = event && event.data;
    if (!data || data.type !== 'SKIP_WAITING') return;
    // allow the waiting worker to immediately activate
    self.skipWaiting();
  } catch (err) {
    // guard: message handling must never throw
    console.error('[service-worker] message handler error', err && err.stack || err);
  }
});
