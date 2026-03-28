// Version du cache — incrementer a chaque deploiement majeur
const CACHE_VERSION = 'smartpointage-v5';
const CACHE_NAME = CACHE_VERSION;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/app.js',
  '/src/css/global.css',
  '/src/api.js',
  '/src/pages/login.js',
  '/src/pages/dashboard.js',
  '/src/pages/pointage.js',
  '/src/pages/agents.js',
  '/src/pages/sites.js',
  '/src/pages/rapports.js',
  '/src/components/navbar.js',
  '/src/components/modal.js',
  '/src/components/toast.js',
  '/src/store/indexedDB.js',
  '/src/store/syncManager.js',
  '/manifest.json'
];

// â”€â”€â”€ Install : mise en cache des assets statiques â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('install', (event) => {
  // âœ… Force l'activation immÃ©diate sans attendre la fermeture des onglets
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// â”€â”€â”€ Activate : supprimer les anciens caches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('activate', (event) => {
  // âœ… Prendre le contrÃ´le immÃ©diatement de tous les onglets ouverts
  clients.claim();
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
});

// â”€â”€â”€ Fetch : stratÃ©gie network-first pour API, cache-first pour static â”€â”€
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requÃªtes externes (fonts, CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // âœ… API : network-first (toujours frais), pas de cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ message: 'Hors ligne — reessayez plus tard.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // âœ… SW.js lui-mÃªme : toujours depuis le rÃ©seau pour dÃ©tecter les mises Ã  jour
  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(event.request));
    return;
  }

  // âœ… Fichiers JS/CSS : network-first pour toujours avoir la derniÃ¨re version
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // âœ… Autres assets (images, fonts locales) : cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
