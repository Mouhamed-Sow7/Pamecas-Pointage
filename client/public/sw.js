const STATIC_CACHE = 'pamecas-static-v2';
const API_CACHE = 'pamecas-api-v2';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/src/app.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (![STATIC_CACHE, API_CACHE].includes(key)) {
            return caches.delete(key);
          }
          return null;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ✅ Ignorer toutes les requêtes externes (CDN, fonts, etc.)
  if (url.origin !== self.location.origin) {
    return; // laisser le navigateur gérer normalement
  }

  // API calls — network first, fallback offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() =>
          new Response(JSON.stringify({ offline: true, data: [] }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          })
        )
    );
    return;
  }

  // Fichiers statiques — cache first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pointages') {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_COMPLETED' });
        });
      })()
    );
  }
});