// ─────────────────────────────────────────────────────────────────
// badgeQR.js — Génération du QR dynamique de badge, 100% côté client.
//
// Miroir exact de server/utils/totp.js (WINDOW_SECONDS=30, HMAC-SHA256,
// 12 premiers hex chars) afin que le QR affiché soit identique à celui
// que le serveur validerait — mais calculé localement, donc disponible
// même sans réseau, à condition que le secret ait été mis en cache une
// fois (voir cacheBadge / getCachedBadge).
//
// Le secret TOTP de l'agent (agent.totp_secret) est sensible : il ne
// doit JAMAIS quitter l'appareil de l'agent lui-même. Il est stocké en
// IndexedDB local uniquement, jamais dans le cache HTTP du service
// worker (qui est purgé/partagé différemment).
// ─────────────────────────────────────────────────────────────────

const WINDOW_SECONDS = 30;
const DB_NAME = "smartpointage-badge";
const DB_VERSION = 1;
const STORE = "badge";
const BADGE_KEY = "current";

function openBadgeDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Appelé UNE FOIS pendant qu'on est en ligne (juste après /agent-portal/me),
// pour permettre la génération du QR hors ligne ensuite.
export async function cacheBadge({ matricule, totp_secret, nom, prenom, site_id }) {
  if (!matricule || !totp_secret) return;
  const db = await openBadgeDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      key: BADGE_KEY,
      matricule,
      totp_secret,
      nom: nom || "",
      prenom: prenom || "",
      site_nom: site_id?.nom || "",
      cached_at: Date.now(),
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedBadge() {
  const db = await openBadgeDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(BADGE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function getTimeWindow(timestamp) {
  return Math.floor((timestamp || Date.now()) / (WINDOW_SECONDS * 1000));
}

// HMAC-SHA256 via Web Crypto (disponible offline, aucune dépendance réseau)
async function hmacHex(secretHex, message) {
  // Le secret est stocké en hex côté serveur (crypto.randomBytes(32).toString("hex"))
  const keyBytes = new Uint8Array(
    secretHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Génère le QR courant "SP:MATRICULE:TOKEN:WINDOW" — identique au format
// serveur (server/utils/totp.js: generateQRData).
export async function generateCurrentQRData(matricule, secretHex, now) {
  const window = getTimeWindow(now);
  const message = `${matricule}:${window}`;
  const fullHex = await hmacHex(secretHex, message);
  const token = fullHex.substring(0, 12);
  return { qrData: `SP:${matricule}:${token}:${window}`, window };
}

// Secondes restantes avant rotation du QR — pour afficher un compte à
// rebours visuel à l'agent (rassure sur le fait que "ça tourne").
export function secondesRestantes(now) {
  const t = now || Date.now();
  return WINDOW_SECONDS - Math.floor((t / 1000) % WINDOW_SECONDS);
}
