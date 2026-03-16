# SmartPointage — Redesign mobile sidebar + UI fixes

## Contexte
Lire navbar.js, app.js, users.js (client) et index.html avant de modifier.
Objectif : sidebar compacte et fonctionnelle sur TOUS les appareils, users page responsive.

---

## MISSION 1 — Bannière hors ligne avec setTimeout (disparaît après 5s)

### client/public/src/app.js
Modifier `updateOfflineBanner` :

```javascript
let offlineTimeout = null;

function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;

  if (!navigator.onLine) {
    banner.classList.add('visible');
    // Auto-masquer après 5 secondes
    if (offlineTimeout) clearTimeout(offlineTimeout);
    offlineTimeout = setTimeout(() => {
      banner.classList.remove('visible');
    }, 5000);
  } else {
    banner.classList.remove('visible');
    if (offlineTimeout) { clearTimeout(offlineTimeout); offlineTimeout = null; }
  }
}
```

---

## MISSION 2 — Sidebar redesign complet responsive

### client/public/index.html
Remplacer TOUTES les règles CSS de sidebar, topbar, nav par celles-ci :

```css
/* ── TOPBAR ─────────────────────────────────────────────── */
.topbar {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 52px;
  background: var(--green);
  color: white;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  z-index: 300;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.topbar-menu-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  line-height: 1;
  min-width: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.topbar-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
  pointer-events: none;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  max-width: 100px;
  overflow: hidden;
}
.topbar-user {
  color: rgba(255,255,255,0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

/* ── OVERLAY ─────────────────────────────────────────────── */
.overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 299;
  backdrop-filter: blur(2px);
}
.overlay.visible { display: block; }

/* ── SIDEBAR ─────────────────────────────────────────────── */
.sidebar {
  width: 220px;
  background: var(--green);
  color: white;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  height: 100dvh; /* dynamic viewport height pour mobile */
  z-index: 400;
  transition: transform 0.25s ease;
  overflow: hidden; /* pas de scroll sur sidebar elle-même */
}

/* Zone scrollable nav */
.sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  /* Cacher la scrollbar */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sidebar-scroll::-webkit-scrollbar { display: none; }

.nav-header {
  padding: 14px 12px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.sidebar-collapse-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.8);
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  display: none;
  min-width: 32px;
  min-height: 32px;
  align-items: center;
  justify-content: center;
}
.sidebar-collapse-btn:hover { background: rgba(255,255,255,0.1); }

.logo { display: flex; align-items: center; gap: 8px; min-width: 0; }
.logo-mark {
  width: 32px; height: 32px;
  background: white;
  color: var(--green);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8rem;
  flex-shrink: 0;
}
.logo-text { min-width: 0; overflow: hidden; }
.logo-text .title {
  font-size: 0.85rem;
  font-weight: 700;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.logo-text .subtitle {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.65);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-menu { padding: 8px 0; flex: 1; }
.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  color: rgba(255,255,255,0.82);
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
  min-height: 44px; /* touch target minimum */
}
.nav-link:hover { background: rgba(255,255,255,0.1); color: white; }
.nav-link-active {
  background: rgba(255,255,255,0.18) !important;
  color: white !important;
  font-weight: 500;
}

/* Footer sidebar — TOUJOURS visible en bas */
.nav-footer {
  padding: 12px;
  border-top: 1px solid rgba(255,255,255,0.15);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--green); /* fond opaque pour couvrir le contenu scrollé */
}
.status-row { display: flex; align-items: center; gap: 6px; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.status-dot.online { background: #4CAF50; }
.status-dot.offline { background: #f44336; }
.status-text { color: rgba(255,255,255,0.75); font-size: 0.78rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { padding: 2px 7px; border-radius: 20px; font-size: 0.68rem; font-weight: 600; }
.badge-synced { background: rgba(76,175,80,0.2); color: #a5d6a7; }
.badge-pending { background: rgba(229,57,53,0.2); color: #ef9a9a; }
.btn-logout {
  width: 100%;
  padding: 10px 12px;
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.9);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  text-align: left;
  transition: background 0.15s;
  white-space: nowrap;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-logout:hover { background: rgba(255,255,255,0.2); }

/* ── MAIN CONTENT ─────────────────────────────────────────── */
.main-content {
  flex: 1;
  margin-left: 220px;
  padding: 24px 28px;
  min-width: 0;
  min-height: 100vh;
}

/* ── MOBILE (< 768px) ────────────────────────────────────── */
@media (max-width: 768px) {
  .topbar { display: flex; }
  .sidebar { transform: translateX(-100%); width: 240px; }
  .sidebar.open { transform: translateX(0); box-shadow: 4px 0 20px rgba(0,0,0,0.3); }
  .main-content { margin-left: 0; padding: 60px 12px 80px; }
  .kpi-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .kpi-value { font-size: 1.6rem; }
  .kpi-label { font-size: 0.7rem; }
  .kpi-card { padding: 12px 10px; }
}

/* ── TABLETTE (769px - 1024px) ──────────────────────────── */
@media (min-width: 769px) and (max-width: 1024px) {
  .topbar { display: flex; }
  .sidebar { transform: translateX(-100%); width: 260px; }
  .sidebar.open { transform: translateX(0); box-shadow: 4px 0 20px rgba(0,0,0,0.3); }
  .main-content { margin-left: 0; padding: 60px 20px 40px; }
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ── DESKTOP (> 1024px) ─────────────────────────────────── */
@media (min-width: 1025px) {
  .topbar { display: none !important; }
  .overlay { display: none !important; }
  .sidebar { transform: translateX(0) !important; }
  .sidebar-collapse-btn { display: flex !important; }
  .sidebar.collapsed { width: 64px; }
  .sidebar.collapsed .logo-text,
  .sidebar.collapsed .nav-text,
  .sidebar.collapsed .status-text,
  .sidebar.collapsed .badge { display: none; }
  .sidebar.collapsed .nav-link { justify-content: center; padding: 11px 8px; }
  .sidebar.collapsed .logo { justify-content: center; }
  .sidebar.collapsed .nav-header { justify-content: center; padding: 14px 8px; }
  .sidebar.collapsed .btn-logout { justify-content: center; padding: 10px 8px; }
  .main-content { margin-left: 220px; }
  .main-content.sidebar-collapsed { margin-left: 64px; }
}
```

### client/public/src/components/navbar.js
Modifier le HTML de la navbar pour utiliser `sidebar-scroll` :

```javascript
container.innerHTML = `
  <div class="nav-header">
    <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" type="button" title="Reduire">
      <i class="fa-solid fa-bars"></i>
    </button>
    <div class="logo">
      <div class="logo-mark">SP</div>
      <div class="logo-text">
        <div class="title">SmartPointage</div>
        <div class="subtitle">${instanceNom}</div>
      </div>
    </div>
  </div>
  <div class="sidebar-scroll">
    <nav class="nav-menu">${htmlLinks}</nav>
  </div>
  <div class="nav-footer">
    <div class="status-row">
      <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
      <span class="status-text">${isOnline ? 'En ligne' : 'Hors ligne'}</span>
    </div>
    ${pending > 0 ? `
    <div class="status-row">
      <span class="status-text">Sync</span>
      <span class="badge badge-pending">${pending} en attente</span>
    </div>` : ''}
    <div class="status-row" style="overflow:hidden;">
      <i class="fa-solid fa-user" style="font-size:0.7rem;flex-shrink:0;color:rgba(255,255,255,0.6);"></i>
      <span class="status-text">${user?.username || ''} · ${user?.role || ''}</span>
    </div>
    <button id="btn-logout" class="btn-logout">
      <i class="fa-solid fa-right-from-bracket"></i>
      <span class="nav-text">Deconnexion</span>
    </button>
  </div>
`;
```

---

## MISSION 3 — Page Utilisateurs responsive mobile

### client/public/src/pages/users.js
Remplacer le rendu de la liste users par des cartes mobile-friendly.
Le problème actuel : icônes qui se superposent sur mobile, container trop petit.

Modifier `renderUsers` pour utiliser ce layout :

```javascript
// Container principal avec hauteur dynamique
root.innerHTML = `
  <div style="display:flex;flex-direction:column;height:calc(100vh - 120px);min-height:400px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <h2 style="font-size:1.1rem;font-weight:700;">
        <i class="fa-solid fa-users-gear" style="color:#2e7d32;margin-right:6px;"></i>Gestion des utilisateurs
      </h2>
      <button id="btn-add-user" class="btn-primary">
        <i class="fa-solid fa-plus"></i> Ajouter
      </button>
    </div>

    <!-- Liste scrollable interne -->
    <div id="users-list" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:2px;scrollbar-width:thin;scrollbar-color:#c8e6c9 #f5f5f5;">
      <div style="text-align:center;padding:20px;color:#999;">
        <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
      </div>
    </div>
  </div>
`;

// Dans renderUsersList, chaque user = carte responsive :
function renderUserCard(user, canEdit) {
  const rc = roleConfig[user.role] || { label: user.role, color: '#555', bg: '#f5f5f5' };
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:white;border:1px solid #eee;border-radius:10px;border-left:3px solid ${rc.color};">
      <!-- Avatar -->
      <div style="width:38px;height:38px;border-radius:50%;background:${rc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fa-solid fa-user" style="color:${rc.color};font-size:0.9rem;"></i>
      </div>

      <!-- Infos -->
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.nom_complet || user.username}</div>
        <div style="font-size:0.75rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">@${user.username} · ${user.site_id?.nom || user.sites_ids?.length > 0 ? user.sites_ids.length + ' agences' : '—'}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
          <span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:${rc.bg};color:${rc.color};font-weight:600;">${rc.label}</span>
          <span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:${user.actif ? '#e8f5e9' : '#f5f5f5'};color:${user.actif ? '#2e7d32' : '#999'};font-weight:500;">${user.actif ? 'Actif' : 'Inactif'}</span>
        </div>
      </div>

      <!-- Actions — toujours visibles, pas de superposition -->
      ${canEdit ? `
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
        <button class="btn-edit-user" data-id="${user._id}"
          style="width:32px;height:32px;border-radius:8px;border:1.5px solid #1565c0;background:white;color:#1565c0;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;justify-content:center;"
          title="Modifier">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-toggle-user" data-id="${user._id}" data-actif="${user.actif}"
          style="width:32px;height:32px;border-radius:8px;border:1.5px solid ${user.actif ? '#c62828' : '#2e7d32'};background:white;color:${user.actif ? '#c62828' : '#2e7d32'};cursor:pointer;font-size:0.75rem;display:flex;align-items:center;justify-content:center;"
          title="${user.actif ? 'Désactiver' : 'Activer'}">
          <i class="fa-solid ${user.actif ? 'fa-ban' : 'fa-circle-check'}"></i>
        </button>
      </div>` : ''}
    </div>
  `;
}
```

---

## MISSION 4 — Topbar title dynamique

### client/public/src/app.js
Le titre dans la topbar doit correspondre à la page active.
Vérifier que `topbarTitle.textContent` est bien mis à jour pour chaque route.
Ajouter pour la route `/users` :
```javascript
} else if (route === '/users') {
  if (topbarTitle) topbarTitle.textContent = 'Utilisateurs';
  renderUsers(main, user);
}
```

---

## Commit

```bash
git add .
git commit -m "fix: sidebar responsive compacte + banniere offline timeout + users mobile cards"
git push
```

---

## Résumé des fixes

| Problème | Fix |
|----------|-----|
| Bouton déconnexion hors portée | nav-footer flex-shrink:0 + background opaque |
| Sidebar scroll bloque footer | sidebar-scroll zone + footer fixe en bas |
| Bannière hors ligne permanente | setTimeout 5s puis disparaît |
| Icônes users superposées mobile | Cartes avec actions en colonne flex |
| Container users trop petit | height: calc(100vh - 120px) |
| Touch targets trop petits | min-height: 44px sur tous les boutons nav |
| Hamburger invisible hors ligne | topbar z-index 300, toujours visible |
