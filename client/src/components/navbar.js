import { getBadgeCount } from '../store/syncManager.js';

export async function renderNavbar(container, currentRoute, user) {
  const pending = await getBadgeCount();
  const isOnline = navigator.onLine;

  const links = [];

  links.push({ path: '#/dashboard', label: 'Dashboard' });
  links.push({ path: '#/pointage', label: 'Pointage' });

  if (user && (user.role === 'superviseur' || user.role === 'admin' || user.role === 'superadmin')) {
    links.push({ path: '#/agents', label: 'Agents' });
  }

  if (user && (user.role === 'admin' || user.role === 'superadmin')) {
    links.push({ path: '#/rapports', label: 'Rapports' });
    links.push({ path: '#/sites', label: 'Sites' });
  }

  const htmlLinks = links
    .map((link) => {
      const isActive = currentRoute === link.path.replace('#', '');
      return `
        <button class="nav-link ${isActive ? 'nav-link-active' : ''}" data-path="${link.path}">
          ${link.label}
        </button>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="nav-header">
      <div class="logo">
        <div class="logo-mark">GDS</div>
        <div class="logo-text">
          <div class="title">GDS Pointage</div>
          <div class="subtitle">Grands Domaines du Sénégal</div>
        </div>
      </div>
    </div>
    <nav class="nav-menu">
      ${htmlLinks}
    </nav>
    <div class="nav-footer">
      <div class="status-row">
        <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
        <span class="status-text">${isOnline ? 'En ligne' : 'Hors ligne'}</span>
      </div>
      <div class="status-row">
        <span class="status-text">Sync</span>
        <span class="badge ${pending ? 'badge-pending' : 'badge-synced'}">
          ${pending} en attente
        </span>
      </div>
      <button id="btn-logout" class="btn-logout">Déconnexion</button>
    </div>
  `;

  container.querySelectorAll('.nav-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const path = btn.getAttribute('data-path');
      window.location.hash = path;
    });
  });

  const logoutBtn = container.querySelector('#btn-logout');
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('gds_token');
    localStorage.removeItem('gds_user');
    window.location.hash = '#/login';
  });
}

