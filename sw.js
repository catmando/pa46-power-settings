/*
 * Service worker: caches the whole app so it runs fully offline.
 * Bump CACHE_VERSION whenever any cached file changes to force an update.
 */
const CACHE_VERSION = 'pa46-v22';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './calc.js',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Cache-first: instant, works offline. Falls back to network for anything new.
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (resp) {
        return resp;
      }).catch(function () {
        // Offline and not cached: for navigations, fall back to the app shell.
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504 });
      });
    })
  );
});
