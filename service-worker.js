const CACHE = 'onenote-cleaner-v2';
// Include worker files in precache so clients update worker code during releases
const ASSETS = ['/', '/index.html', '/styles.css', '/src/app.js', '/src/worker.js', '/src/worker-globals.js'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
