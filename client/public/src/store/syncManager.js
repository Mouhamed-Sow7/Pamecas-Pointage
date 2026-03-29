import { getPendingPointages, clearSynced } from './indexedDB.js';

const syncCallbacks = [];
let autoSyncStarted = false;

export async function syncPending() {
  try {
    const pending = await getPendingPointages();
    if (!pending.length) {
      return 0;
    }

    const body = {
      pointages: pending
    };

    const response = await fetch('/api/pointages/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('pamecas_token') || localStorage.getItem('kiosque_mode') || '')
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Sync Ã©chouÃ©e');
    }

    const localIds = pending.map((p) => p.local_id);
    await clearSynced(localIds);

    syncCallbacks.forEach((cb) => {
      try {
        cb(localIds.length);
      } catch (e) {
        // ignore callback error
      }
    });

    return localIds.length;
  } catch (err) {
    console.error('Erreur lors de la synchronisation des pointages:', err);
    return 0;
  }
}

export function startAutoSync() {
  if (autoSyncStarted) return;
  autoSyncStarted = true;

  // Sync au retour connexion (dÃ©lai: Ã©vite faux positifs iOS/Android)
  window.addEventListener('online', () => {
    setTimeout(() => syncPending(), 1000);
  });

  // Polling 30s â€” filet de sÃ©curitÃ© mobile (online peu fiable)
  setInterval(async () => {
    if (!navigator.onLine) return;
    try {
      const pending = await getPendingPointages();
      if (pending.length > 0) syncPending();
    } catch {
      // ignore
    }
  }, 30000);

  // Au dÃ©marrage: tenter une sync si des pointages sont en attente
  setTimeout(async () => {
    if (!navigator.onLine) return;
    try {
      const pending = await getPendingPointages();
      if (pending.length > 0) syncPending();
    } catch {
      // ignore
    }
  }, 3000);

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((registration) => {
        return getPendingPointages().then((pending) => {
          if (pending.length) {
            return registration.sync.register('sync-pointages');
          }
          return null;
        });
      })
      .catch(() => {
        // ignore
      });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SYNC_COMPLETED') {
        syncPending();
      }
    });
  }
}

export async function getBadgeCount() {
  const pending = await getPendingPointages();
  return pending.length;
}

export function onSyncComplete(callback) {
  if (typeof callback === 'function') {
    syncCallbacks.push(callback);
  }
}



