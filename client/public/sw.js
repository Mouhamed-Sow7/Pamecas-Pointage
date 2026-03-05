const STATIC_CACHE = 'gds-static-v1';
const API_CACHE = 'gds-api-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/src/app.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
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

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() =>
          new Response(JSON.stringify({ offline: true, data: [] }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          })
        )
    );
    return;
  }

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

