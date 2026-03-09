// ✅ Version du cache — incrémentez ce numéro à chaque déploiement
const CACHE_VERSION = 'v6';
const CACHE_NAME = `pamecas-pointage-${CACHE_VERSION}`;

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

// ─── Install : mise en cache des assets statiques ────────────────
self.addEventListener('install', (event) => {
  // ✅ Force l'activation immédiate sans attendre la fermeture des onglets
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ─── Activate : supprimer les anciens caches ─────────────────────
self.addEventListener('activate', (event) => {
  // ✅ Prendre le contrôle immédiatement de tous les onglets ouverts
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

// ─── Fetch : stratégie network-first pour API, cache-first pour static ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes externes (fonts, CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // ✅ API : network-first (toujours frais), pas de cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ message: 'Hors ligne — réessayez plus tard.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // ✅ SW.js lui-même : toujours depuis le réseau pour détecter les mises à jour
  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(event.request));
    return;
  }

  // ✅ Fichiers JS/CSS : network-first pour toujours avoir la dernière version
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

  // ✅ Autres assets (images, fonts locales) : cache-first
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