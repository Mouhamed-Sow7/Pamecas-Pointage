import { getCachedAgents } from './store/indexedDB.js';

const BASE_URL = '';

function getToken() {
  return localStorage.getItem('pamecas_token');
}

function handleUnauthorized() {
  if (!window.location.hash.startsWith('#/login')) {
    window.location.hash = '#/login';
  }
}

async function request(method, url, data) {
  const headers = {
    'Content-Type': 'application/json'
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const fullUrl = `${BASE_URL}${url}`;

  try {
    const response = await fetch(fullUrl, options);

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('Non autorisÃ©');
    }

    const contentType = response.headers.get('Content-Type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        (payload && payload.message) ||
        'Erreur lors de la communication avec le serveur.';
      throw new Error(message);
    }

    return payload;
  } catch (err) {
    if (
      !navigator.onLine &&
      method === 'GET' &&
      url.startsWith('/api/agents')
    ) {
      const cached = await getCachedAgents();
      return { data: cached, offline: true };
    }
    throw err;
  }
}

export function get(url) {
  return request('GET', url);
}

export function post(url, data) {
  return request('POST', url, data);
}

export function put(url, data) {
  return request('PUT', url, data);
}

export function del(url) {
  return request('DELETE', url);
}


