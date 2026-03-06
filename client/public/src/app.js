import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderPointage } from './pages/pointage.js';
import { renderAgents } from './pages/agents.js';
import { renderRapports } from './pages/rapports.js';
import { renderSites } from './pages/sites.js';
import {
  renderNavbar,
  initResponsiveSidebar,
  openSidebar,
  closeSidebar
} from './components/navbar.js';
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
    <div class="topbar" id="topbar">
      <button id="topbar-menu-btn" class="topbar-menu-btn" type="button">☰</button>
      <div class="topbar-title" id="topbar-title"></div>
      <div class="topbar-right">
        <span class="status-dot ${navigator.onLine ? 'online' : 'offline'}"></span>
        <span class="topbar-user">${user?.username || ''}</span>
      </div>
    </div>
    <div class="overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="sidebar"></aside>
    <main class="main-content" id="main-content"></main>
  `;

  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');
  const topbarTitle = document.getElementById('topbar-title');
  const topbarMenuBtn = document.getElementById('topbar-menu-btn');
  const overlay = document.getElementById('sidebar-overlay');

  renderNavbar(sidebar, route, user);

  if (route === '/' || route === '/dashboard') {
    if (topbarTitle) topbarTitle.textContent = 'Dashboard';
    renderDashboard(main, user);
  } else if (route === '/pointage') {
    if (topbarTitle) topbarTitle.textContent = 'Pointage';
    renderPointage(main, user);
  } else if (route === '/agents') {
    if (topbarTitle) topbarTitle.textContent = 'Agents';
    renderAgents(main, user);
  } else if (route === '/sites') {
    if (topbarTitle) topbarTitle.textContent = 'Sites';
    renderSites(main, user);
  } else if (route === '/rapports') {
    if (topbarTitle) topbarTitle.textContent = 'Rapports';
    renderRapports(main, user);
  } else {
    main.innerHTML = '<div class="card">Page non trouvée.</div>';
  }

  if (topbarMenuBtn) {
    topbarMenuBtn.addEventListener('click', () => {
      openSidebar();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      closeSidebar();
    });
  }

  initResponsiveSidebar();
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

