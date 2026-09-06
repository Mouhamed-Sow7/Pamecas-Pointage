// Version du cache â€” incrementer a chaque deploiement majeur
const CACHE_VERSION = "smartpointage-v16";
const CACHE_NAME = CACHE_VERSION;

const STATIC_ASSETS = [
  "/app/",
  "/app/index.html",
  "/app/src/app.js",
  "/app/src/css/global.css",
  "/app/src/api.js",
  "/app/src/pages/login.js",
  "/app/src/pages/dashboard.js",
  "/app/src/pages/pointage.js",
  "/app/src/pages/agents.js",
  "/app/src/pages/sites.js",
  "/app/src/pages/rapports.js",
  "/app/src/pages/demandes.js",
  "/app/src/pages/conges.js",
  "/app/src/components/navbar.js",
  "/app/src/components/modal.js",
  "/app/src/components/toast.js",
  "/app/src/store/indexedDB.js",
  "/app/src/store/syncManager.js",
  "/app/manifest.json",
];

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Install : mise en cache des assets statiques Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
self.addEventListener("install", (event) => {
  // Ã¢Å“â€¦ Force l'activation immÃƒÂ©diate sans attendre la fermeture des onglets
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Activate : supprimer les anciens caches Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
self.addEventListener("activate", (event) => {
  // Ã¢Å“â€¦ Prendre le contrÃƒÂ´le immÃƒÂ©diatement de tous les onglets ouverts
  clients.claim();
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Suppression ancien cache:", key);
            return caches.delete(key);
          }),
      ),
    ),
  );
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Fetch : stratÃƒÂ©gie network-first pour API, cache-first pour static Ã¢â€â‚¬Ã¢â€â‚¬
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requÃƒÂªtes externes (fonts, CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // Ã¢Å“â€¦ API : network-first (toujours frais), pas de cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            JSON.stringify({ message: "Hors ligne â€” reessayez plus tard." }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );
    return;
  }

  // Ã¢Å“â€¦ SW.js lui-mÃƒÂªme : toujours depuis le rÃƒÂ©seau pour dÃƒÂ©tecter les mises ÃƒÂ  jour
  if (url.pathname === "/sw.js") {
    event.respondWith(fetch(event.request));
    return;
  }
  // agent.html : toujours network-first
  if (url.pathname === "/agent" || url.pathname === "/agent.html") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // Ã¢Å“â€¦ Fichiers JS/CSS : network-first pour toujours avoir la derniÃƒÂ¨re version
  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // Ã¢Å“â€¦ Autres assets (images, fonts locales) : cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }),
  );
});
