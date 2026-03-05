import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderPointage } from './pages/pointage.js';
import { renderAgents } from './pages/agents.js';
import { renderRapports } from './pages/rapports.js';
import { renderNavbar } from './components/navbar.js';
import { startAutoSync, onSyncComplete } from './store/syncManager.js';
import { showToast } from './components/toast.js';

function getCurrentUser() {
  const raw = localStorage.getItem('gds_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function isAuthenticated() {
  return !!localStorage.getItem('gds_token');
}

function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  if (!navigator.onLine) {
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

function mountLayout(route, user) {
  const app = document.getElementById('app');
  if (!app) return;

  if (route === '/login') {
    app.className = '';
    app.innerHTML = '';
    renderLogin(app);
    return;
  }

  app.className = 'layout-with-sidebar';
  app.innerHTML = `
    <aside class="sidebar" id="sidebar"></aside>
    <main class="main-content" id="main-content"></main>
  `;

  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');

  renderNavbar(sidebar, route, user);

  if (route === '/' || route === '/dashboard') {
    renderDashboard(main, user);
  } else if (route === '/pointage') {
    renderPointage(main, user);
  } else if (route === '/agents') {
    renderAgents(main, user);
  } else if (route === '/rapports') {
    renderRapports(main, user);
  } else {
    main.innerHTML = '<div class="card">Page non trouvée.</div>';
  }
}

function router() {
  updateOfflineBanner();

  const hash = window.location.hash || '#/dashboard';
  const route = hash.replace('#', '') || '/dashboard';

  if (!isAuthenticated() && route !== '/login') {
    window.location.hash = '#/login';
    return;
  }

  const user = getCurrentUser();

  if (!user && route !== '/login') {
    window.location.hash = '#/login';
    return;
  }

  mountLayout(route, user);
}

window.addEventListener('hashchange', router);
window.addEventListener('online', updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);

document.addEventListener('DOMContentLoaded', () => {
  updateOfflineBanner();
  startAutoSync();
  onSyncComplete((count) => {
    if (count > 0) {
      showToast(`${count} pointage(s) synchronisé(s).`, 'success');
    }
  });
  router();
});

