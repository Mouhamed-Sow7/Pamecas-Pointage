import { getPendingPointages, clearSynced } from './indexedDB.js';

const syncCallbacks = [];

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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Sync échouée');
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
  window.addEventListener('online', () => {
    syncPending();
  });

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

