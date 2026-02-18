const CACHE = 'onenote-cleaner-v2';
const ASSETS = ['/', '/index.html', '/styles.css', '/src/app.js', '/src/worker.js', '/src/worker-globals.js'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('activate', e => {
  // Remove old caches on activation so clients update promptly
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
