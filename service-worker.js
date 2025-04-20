const CACHE_NAME = 'voice-translator-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icon.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response or fetch from network
        return response || fetch(event.request)
          .then((networkResponse) => {
            // Update cache for future use
            if (event.request.url.startsWith('http')) {
              const cache = caches.open(CACHE_NAME);
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback
            return caches.match('/index.html');
          });
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});