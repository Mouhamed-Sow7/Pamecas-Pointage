import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderPointage } from './pages/pointage.js';
import { renderAgents } from './pages/agents.js';
import { renderRapports } from './pages/rapports.js';
import { renderSites } from './pages/sites.js';
import { renderKiosque } from './pages/kiosque.js';
import { renderUsers } from './pages/users.js';
import {
  renderNavbar,
  initResponsiveSidebar,
  openSidebar,
  closeSidebar
} from './components/navbar.js';
import { startAutoSync, onSyncComplete } from './store/syncManager.js';
import { showToast } from './components/toast.js';

function getCurrentUser() {
  const raw = localStorage.getItem('pamecas_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function isAuthenticated() {
  return !!localStorage.getItem('pamecas_token');
}

let offlineTimeout = null;

function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;

  if (!navigator.onLine) {
    banner.classList.add('visible');
    if (offlineTimeout) clearTimeout(offlineTimeout);
    offlineTimeout = setTimeout(() => {
      banner.classList.remove('visible');
    }, 5000);
  } else {
    banner.classList.remove('visible');
    if (offlineTimeout) { clearTimeout(offlineTimeout); offlineTimeout = null; }
  }
}

function mountLayout(route, user) {
  const app = document.getElementById('app');
  if (!app) return;

  // ─── Mode kiosque — pas de login, pas de sidebar ───────────────
  if (route.startsWith('/kiosque')) {
    app.className = '';
    app.innerHTML = '';
    renderKiosque(app);
    return;
  }

  if (route === '/login') {
    app.className = '';
    app.innerHTML = '';
    renderLogin(app);
    return;
  }

  app.className = 'layout-with-sidebar';
  app.innerHTML = `
    <div class="topbar" id="topbar">
      <button id="topbar-menu-btn" class="topbar-menu-btn" type="button"><i class="fa-solid fa-bars"></i></button>
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
    renderRapports(main, user).catch(() => {});
  } else if (route === '/users') {
    if (topbarTitle) topbarTitle.textContent = 'Utilisateurs';
    renderUsers(main, user);
  } else {
    main.innerHTML = `
      <div style="min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#aaa;">
        <i class="fa-solid fa-map-location-dot" style="font-size:3rem;margin-bottom:16px;color:#ddd;"></i>
        <div style="font-size:1.1rem;font-weight:600;color:#555;margin-bottom:8px;">Page introuvable</div>
        <div style="font-size:0.85rem;margin-bottom:20px;">La page demandee n'existe pas.</div>
        <button onclick="window.location.hash='#/dashboard'"
          style="padding:9px 20px;background:#2e7d32;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;">
          <i class="fa-solid fa-house"></i> Retour au dashboard
        </button>
      </div>
    `;
  }

  if (topbarMenuBtn) topbarMenuBtn.addEventListener('click', openSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
  initResponsiveSidebar();
}

function router() {
  updateOfflineBanner();

  const hash = window.location.hash || '#/dashboard';
  const route = hash.replace('#', '').split('?')[0] || '/dashboard';

  // Kiosque — pas besoin d'authentification
  if (route.startsWith('/kiosque')) {
    mountLayout(route, null);
    return;
  }

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
    if (count > 0) showToast(`${count} pointage(s) synchronise(s).`, 'success');
  });
  router();
});
