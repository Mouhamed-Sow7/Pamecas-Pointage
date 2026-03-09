const DB_NAME = 'pamecas-pointage-offline';
const DB_VERSION = 1;
const STORE_POINTAGES = 'pointages_pending';
const STORE_AGENTS = 'agents_cache';
const STORE_AUTH = 'auth_cache';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_POINTAGES)) {
        db.createObjectStore(STORE_POINTAGES, {
          keyPath: 'local_id'
        });
      }
      if (!db.objectStoreNames.contains(STORE_AGENTS)) {
        db.createObjectStore(STORE_AGENTS, {
          keyPath: 'id'
        });
      }
      if (!db.objectStoreNames.contains(STORE_AUTH)) {
        db.createObjectStore(STORE_AUTH, {
          keyPath: 'key'
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function uuidv4() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function savePointage(pointage) {
  const db = await openDB();
  const tx = db.transaction(STORE_POINTAGES, 'readwrite');
  const store = tx.objectStore(STORE_POINTAGES);

  const record = {
    ...pointage,
    local_id: pointage.local_id || uuidv4(),
    created_at: new Date().toISOString()
  };

  store.put(record);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingPointages() {
  const db = await openDB();
  const tx = db.transaction(STORE_POINTAGES, 'readonly');
  const store = tx.objectStore(STORE_POINTAGES);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSynced(localIds) {
  if (!Array.isArray(localIds) || !localIds.length) return;

  const db = await openDB();
  const tx = db.transaction(STORE_POINTAGES, 'readwrite');
  const store = tx.objectStore(STORE_POINTAGES);

  localIds.forEach((id) => {
    store.delete(id);
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheAgents(agents) {
  if (!Array.isArray(agents)) return;

  const db = await openDB();
  const tx = db.transaction(STORE_AGENTS, 'readwrite');
  const store = tx.objectStore(STORE_AGENTS);

  agents.forEach((agent) => {
    store.put({
      ...agent,
      id: agent._id || agent.id
    });
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedAgents() {
  const db = await openDB();
  const tx = db.transaction(STORE_AGENTS, 'readonly');
  const store = tx.objectStore(STORE_AGENTS);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAuth(token, user) {
  const db = await openDB();
  const tx = db.transaction(STORE_AUTH, 'readwrite');
  const store = tx.objectStore(STORE_AUTH);

  store.put({
    key: 'auth',
    token,
    user,
    saved_at: new Date().toISOString()
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAuth() {
  const db = await openDB();
  const tx = db.transaction(STORE_AUTH, 'readonly');
  const store = tx.objectStore(STORE_AUTH);

  return new Promise((resolve, reject) => {
    const request = store.get('auth');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

