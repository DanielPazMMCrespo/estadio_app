const CACHE_NAME = 'estadio-shell-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install Event: Safe precaching of app shell core using Promise.allSettled
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { cache: 'no-cache' });
            if (response.ok) {
              await cache.put(asset, response);
            }
          } catch (err) {
            console.warn(`[SW Precache] Failed to precache asset: ${asset}`, err);
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Claim clients and clean obsolete caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`[SW] Deleting obsolete cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event.
// A casca (navegação / index.html) usa Network-First: sem isto, uma app
// instalada (PWA) nunca via as atualizações a sério — ficava sempre a
// mostrar o HTML antigo em cache, que aponta para JS/CSS antigos, e só
// se via a versão nova ao fim de reabrir a app duas vezes. Os ficheiros
// com hash no nome (JS/CSS gerados pelo build) continuam com
// Stale-While-Revalidate: são imutáveis (nome novo a cada build), por
// isso servir do cache primeiro é seguro e mais rápido.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  const isAppShell = event.request.mode === 'navigate' || url.pathname === '/index.html';

  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[SW Fetch] Network fetch failed, falling back to cache:', event.request.url, err);
        });

      return cachedResponse || fetchPromise;
    })
  );
});
