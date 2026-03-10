import { getBadgeCount } from '../store/syncManager.js';

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');
  if (!sidebar) return;
  if (window.innerWidth >= 1025) {
    sidebar.classList.toggle('collapsed');
    if (main) main.classList.toggle('sidebar-collapsed');
  }
}

export function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.add('open');
  if (overlay) overlay.classList.add('visible');
}

export function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('visible');
}

export function initResponsiveSidebar() {
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1025) {
      closeSidebar();
    }
  });
}

export async function renderNavbar(container, currentRoute, user) {
  const pending = await getBadgeCount();
  const isOnline = navigator.onLine;

  const links = [
    { path: '#/dashboard', label: 'Dashboard', icon: '<i class="fa-regular fa-house"></i>' },
    { path: '#/pointage', label: 'Pointage', icon: '<i class="fa-regular fa-circle-dot"></i>' },  
  ];

  if (user && ['superviseur','admin','superadmin'].includes(user.role)) {
    links.push({ path: '#/agents', label: 'Agents', icon: '<i class="fa-solid fa-users"></i>' });
  }
  if (user && ['admin','superadmin'].includes(user.role)) {
    links.push({ path: '#/rapports', label: 'Rapports', icon: '<i class="fa-regular fa-file-alt"></i>' });
    links.push({ path: '#/sites', label: 'Agences', icon: '<i class="fa-regular fa-building"></i>' });
  }

  const htmlLinks = links.map((link) => {
    const isActive = currentRoute === link.path.replace('#', '');
    return `
      <button class="nav-link ${isActive ? 'nav-link-active' : ''}" data-path="${link.path}">
        <span style="font-size:1rem;width:20px;text-align:center;">${link.icon}</span>
        <span class="nav-text">${link.label}</span>
      </button>
    `;
  }).join('');

  container.innerHTML = `
    <div class="nav-header">
      <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" type="button" title="RÃ©duire">
        <i class="fa-solid fa-bars"></i>
      </button>
      <div class="logo">
        <div class="logo-mark">PM</div>
        <div class="logo-text">
          <div class="title">PAMECAS Pointage</div>
          <div class="subtitle">PAMECAS</div>
        </div>
      </div>
    </div>
    <nav class="nav-menu">${htmlLinks}</nav>
    <div class="nav-footer">
      <div class="status-row">
        <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
        <span class="status-text">${isOnline ? 'En ligne' : 'Hors ligne'}</span>
      </div>
      <div class="status-row">
        <span class="status-text">Sync</span>
        <span class="badge ${pending > 0 ? 'badge-pending' : 'badge-synced'}">${pending} en attente</span>
      </div>
      <button id="btn-logout" class="btn-logout">ðŸšª DÃ©connexion</button>
    </div>
  `;

  container.querySelectorAll('.nav-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeSidebar();
      window.location.hash = btn.getAttribute('data-path');
    });
  });

  const logoutBtn = container.querySelector('#btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('pamecas_token');
      localStorage.removeItem('pamecas_user');
      window.location.hash = '#/login';
    });
  }

  const collapseBtn = container.querySelector('#sidebar-collapse-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', toggleSidebar);
  }
}
