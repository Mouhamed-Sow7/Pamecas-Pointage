// client/public/src/pages/users.js
import { showToast } from '../components/toast.js';

const API = '/api';

const roleConfig = {
  superadmin:         { label: 'Super Admin',   color: '#c62828', bg: '#ffebee' },
  directeur_regional: { label: 'Dir. Régional', color: '#6a1b9a', bg: '#f3e5f5' },
  admin:              { label: 'Admin',          color: '#1565c0', bg: '#e3f2fd' },
  superviseur:        { label: 'Superviseur',    color: '#e65100', bg: '#fff3e0' },
  pointeur:           { label: 'Pointeur',       color: '#2e7d32', bg: '#e8f5e9' },
};

function getToken() {
  return localStorage.getItem('pamecas_token') || '';
}

function roleBadge(role) {
  const cfg = roleConfig[role] || { label: role, color: '#555', bg: '#eee' };
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;color:${cfg.color};background:${cfg.bg};">${cfg.label}</span>`;
}

async function fetchUsers() {
  const res = await fetch(`${API}/users`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur chargement users');
  return data.data || [];
}

async function fetchSites() {
  const res = await fetch(`${API}/sites`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur chargement sites');
  return data.data || [];
}

export async function renderUsers(container, currentUser) {
  if (!currentUser || currentUser.role !== 'superadmin') {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:#aaa;">
        <i class="fa-solid fa-lock" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
        <div>Accès réservé au Super Administrateur</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 120px);min-height:400px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <h2 style="font-size:1.1rem;font-weight:700;">
          <i class="fa-solid fa-users-gear" style="color:#2e7d32;margin-right:6px;"></i>Gestion des utilisateurs
        </h2>
        <button id="btn-add-user" class="btn-primary">
          <i class="fa-solid fa-plus"></i> Ajouter
        </button>
      </div>
      <div id="users-list" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:2px;scrollbar-width:thin;scrollbar-color:#c8e6c9 #f5f5f5;">
        <div style="text-align:center;padding:20px;color:#999;">
          <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
        </div>
      </div>
    </div>
  `;

  let sites = [];
  let users = [];

  async function loadAndRender() {
    try {
      [users, sites] = await Promise.all([fetchUsers(), fetchSites()]);
      renderList();
    } catch (err) {
      container.querySelector('#users-list').innerHTML = `<div style="padding:24px;text-align:center;color:#c62828;">${err.message}</div>`;
    }
  }

  function renderUserCard(u, canEdit) {
    const rc = roleConfig[u.role] || { label: u.role, color: '#555', bg: '#f5f5f5' };
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:white;border:1px solid #eee;border-radius:10px;border-left:3px solid ${rc.color};">
        <div style="width:38px;height:38px;border-radius:50%;background:${rc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fa-solid fa-user" style="color:${rc.color};font-size:0.9rem;"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.nom_complet || u.username}</div>
          <div style="font-size:0.75rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">@${u.username} · ${u.site_id?.nom || (u.sites_ids?.length > 0 ? u.sites_ids.length + ' agences' : '—')}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
            <span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:${rc.bg};color:${rc.color};font-weight:600;">${rc.label}</span>
            <span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:${u.actif ? '#e8f5e9' : '#f5f5f5'};color:${u.actif ? '#2e7d32' : '#999'};font-weight:500;">${u.actif ? 'Actif' : 'Inactif'}</span>
          </div>
        </div>
        ${canEdit ? `
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
          <button class="btn-edit-user" data-id="${u._id}"
            style="width:32px;height:32px;border-radius:8px;border:1.5px solid #1565c0;background:white;color:#1565c0;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;justify-content:center;"
            title="Modifier">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-toggle-user" data-id="${u._id}" data-actif="${u.actif}"
            style="width:32px;height:32px;border-radius:8px;border:1.5px solid ${u.actif ? '#c62828' : '#2e7d32'};background:white;color:${u.actif ? '#c62828' : '#2e7d32'};cursor:pointer;font-size:0.75rem;display:flex;align-items:center;justify-content:center;"
            title="${u.actif ? 'Désactiver' : 'Activer'}">
            <i class="fa-solid ${u.actif ? 'fa-ban' : 'fa-circle-check'}"></i>
          </button>
        </div>` : ''}
      </div>
    `;
  }

  function renderList() {
    const list = container.querySelector('#users-list');
    if (!users.length) {
      list.innerHTML = `<div style="padding:40px;text-align:center;color:#aaa;">Aucun utilisateur trouvé.</div>`;
      return;
    }

    const canEdit = currentUser?.role === 'superadmin';
    list.innerHTML = users.map(u => renderUserCard(u, canEdit)).join('');

    list.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = users.find(x => x._id === btn.dataset.id);
        if (u) openModal(u);
      });
    });

    list.querySelectorAll('.btn-toggle-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Désactiver cet utilisateur ?')) return;
        try {
          const res = await fetch(`${API}/users/${btn.dataset.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getToken()}` }
          });
          if (!res.ok) throw new Error((await res.json()).message);
          showToast('Utilisateur désactivé.', 'success');
          await loadAndRender();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  function openModal(user = null) {
    const isEdit = !!user;
    const modalId = 'user-modal';

    const roleOptions = Object.entries(roleConfig).map(([val, cfg]) => {
      const selected = user?.role === val ? 'selected' : '';
      return `<option value="${val}" ${selected}>${cfg.label}</option>`;
    }).join('');

    const siteOptions = sites.map(s => {
      const selected = user?.site_id?._id === s._id || user?.site_id === s._id ? 'selected' : '';
      return `<option value="${s._id}" ${selected}>${s.nom} (${s.code})</option>`;
    }).join('');

    const sitesIdsArr = user?.sites_ids?.map(s => s._id || s) || [];
    const sitesCheckboxes = sites.map(s => {
      const checked = sitesIdsArr.includes(s._id) ? 'checked' : '';
      return `
        <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
          <input type="checkbox" class="cb-site" value="${s._id}" ${checked} style="cursor:pointer;">
          <span style="font-size:0.85rem;">${s.nom} (${s.code})</span>
        </label>
      `;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:16px;padding:28px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;position:relative;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <h3 style="margin:0;font-size:1.1rem;font-weight:700;">${isEdit ? 'Modifier' : 'Ajouter'} un utilisateur</h3>
          <button id="modal-close" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:#888;">&times;</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:0.82rem;font-weight:600;color:#555;display:block;margin-bottom:4px;">Nom d'utilisateur *</label>
            <input id="f-username" value="${user?.username || ''}" ${isEdit ? 'disabled' : ''} placeholder="ex: admin.dakar"
              style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:0.9rem;box-sizing:border-box;${isEdit ? 'background:#f5f5f5;' : ''}">
          </div>
          <div>
            <label style="font-size:0.82rem;font-weight:600;color:#555;display:block;margin-bottom:4px;">Mot de passe ${isEdit ? '(laisser vide = inchangé)' : '*'}</label>
            <input id="f-password" type="password" placeholder="${isEdit ? 'Nouveau mot de passe...' : 'Mot de passe'}"
              style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:0.9rem;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:0.82rem;font-weight:600;color:#555;display:block;margin-bottom:4px;">Nom complet</label>
            <input id="f-nom" value="${user?.nom_complet || ''}" placeholder="Prénom NOM"
              style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:0.9rem;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:0.82rem;font-weight:600;color:#555;display:block;margin-bottom:4px;">Rôle *</label>
            <select id="f-role" style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:0.9rem;box-sizing:border-box;">
              ${roleOptions}
            </select>
          </div>

          <!-- Agence unique (pour admin/pointeur/superviseur) -->
          <div id="f-site-wrap">
            <label style="font-size:0.82rem;font-weight:600;color:#555;display:block;margin-bottom:4px;">Agence</label>
            <select id="f-site" style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:0.9rem;box-sizing:border-box;">
              <option value="">— Aucune —</option>
              ${siteOptions}
            </select>
          </div>

          <!-- Multi-agences (pour directeur_regional) -->
          <div id="f-sites-wrap" style="display:none;">
            <label style="font-size:0.82rem;font-weight:600;color:#555;display:block;margin-bottom:8px;">Agences assignées</label>
            <div style="border:1px solid #ddd;border-radius:8px;padding:12px;max-height:200px;overflow-y:auto;">
              ${sitesCheckboxes}
            </div>
          </div>

          <!-- Section kiosque -->
          <div id="kiosque-section" style="display:none;border:1px solid #e0e0e0;border-radius:10px;padding:14px;">
            <div style="font-size:0.82rem;font-weight:700;color:#555;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-tablet-screen-button"></i> Kiosque tablette
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span id="kiosque-site-label" style="font-size:0.82rem;color:#666;"></span>
              <button id="btn-gen-kiosque" style="padding:7px 14px;background:#1565c0;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.82rem;">
                <i class="fa-solid fa-key"></i> Générer URL Kiosque
              </button>
            </div>
            <div id="kiosque-url-wrap" style="display:none;margin-top:10px;">
              <div style="font-size:0.78rem;color:#555;margin-bottom:4px;">URL kiosque :</div>
              <div style="display:flex;gap:6px;align-items:center;">
                <input id="kiosque-url-input" readonly style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:0.75rem;background:#f9f9f9;box-sizing:border-box;">
                <button id="btn-copy-kiosque" style="padding:8px 12px;background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;border-radius:6px;cursor:pointer;font-size:0.8rem;">
                  <i class="fa-solid fa-copy"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:22px;">
          <button id="modal-cancel" style="flex:1;padding:11px;border:1px solid #ddd;border-radius:8px;background:white;cursor:pointer;font-size:0.9rem;">Annuler</button>
          <button id="modal-save" style="flex:2;padding:11px;background:#2e7d32;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;font-weight:600;">
            ${isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const roleSelect = overlay.querySelector('#f-role');
    const siteWrap = overlay.querySelector('#f-site-wrap');
    const sitesWrap = overlay.querySelector('#f-sites-wrap');
    const kiosqueSection = overlay.querySelector('#kiosque-section');
    const kiosqueSiteLabel = overlay.querySelector('#kiosque-site-label');

    function updateRoleUI() {
      const role = roleSelect.value;
      const isDir = role === 'directeur_regional';
      const isSuperadmin = role === 'superadmin';
      siteWrap.style.display = isDir || isSuperadmin ? 'none' : 'block';
      sitesWrap.style.display = isDir ? 'block' : 'none';
      kiosqueSection.style.display = (role === 'admin' || role === 'directeur_regional') ? 'block' : 'none';
      updateKiosqueLabel();
    }

    function updateKiosqueLabel() {
      const siteSelect = overlay.querySelector('#f-site');
      const siteId = siteSelect.value;
      const site = sites.find(s => s._id === siteId);
      kiosqueSiteLabel.textContent = site ? `Agence : ${site.code}` : '';
    }

    roleSelect.addEventListener('change', updateRoleUI);
    overlay.querySelector('#f-site').addEventListener('change', updateKiosqueLabel);
    updateRoleUI();

    // Générer token kiosque
    overlay.querySelector('#btn-gen-kiosque').addEventListener('click', async () => {
      const siteId = overlay.querySelector('#f-site').value;
      if (!siteId) { showToast('Sélectionnez une agence.', 'error'); return; }
      try {
        const res = await fetch(`${API}/sites/${siteId}/kiosque-token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        const siteNom = encodeURIComponent(data.site.nom);
        const url = `${window.location.origin}/#/kiosque?ktoken=${data.token}`;
        overlay.querySelector('#kiosque-url-input').value = url;
        overlay.querySelector('#kiosque-url-wrap').style.display = 'block';
        showToast('Token kiosque généré.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Copier URL kiosque
    overlay.querySelector('#btn-copy-kiosque').addEventListener('click', () => {
      const input = overlay.querySelector('#kiosque-url-input');
      navigator.clipboard.writeText(input.value).then(() => showToast('URL copiée !', 'success'));
    });

    async function save() {
      const username = overlay.querySelector('#f-username').value.trim();
      const password = overlay.querySelector('#f-password').value;
      const nom_complet = overlay.querySelector('#f-nom').value.trim();
      const role = roleSelect.value;
      const site_id = overlay.querySelector('#f-site').value || null;
      const sites_ids = [...overlay.querySelectorAll('.cb-site:checked')].map(cb => cb.value);

      if (!isEdit && (!username || !password || !role)) {
        showToast('username, password et role obligatoires.', 'error');
        return;
      }

      const body = { nom_complet, role, site_id, sites_ids };
      if (!isEdit) { body.username = username; body.password = password; }
      else if (password) body.password = password;

      try {
        const res = await fetch(`${API}/users${isEdit ? '/' + user._id : ''}`, {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        showToast(isEdit ? 'Utilisateur modifié.' : 'Utilisateur créé.', 'success');
        document.body.removeChild(overlay);
        await loadAndRender();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    overlay.querySelector('#modal-save').addEventListener('click', save);
    overlay.querySelector('#modal-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.querySelector('#modal-close').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
  }

  container.querySelector('#btn-add-user').addEventListener('click', () => openModal(null));

  await loadAndRender();
}
