import { get, post, put } from '../api.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const REGIONS_SENEGAL = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kédougou',
  'Kolda',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Sédhiou',
  'Tambacounda',
  'Thiès',
  'Ziguinchor'
];

function renderTable(root, sites) {
  const tbody = root.querySelector('#sites-tbody');
  tbody.innerHTML = '';
  sites.forEach((site) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${site.code}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${site.nom}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${site.region}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${site.responsable || ''}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">
        <span class="${site.actif ? 'badge-present' : 'badge-absent'}">
          ${site.actif ? 'Actif' : 'Inactif'}
        </span>
      </td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">
        <button class="btn-action" data-id="${site._id}" data-action="edit">✏️</button>
        <button class="btn-action" data-id="${site._id}" data-action="toggle">
          ${site.actif ? 'Désactiver' : 'Activer'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function fetchSites(root) {
  try {
    const res = await get('/api/sites');
    const sites = res.data || res || [];
    renderTable(root, sites);
  } catch (err) {
    showToast(
      'Erreur lors du chargement des sites. Vérifiez votre connexion ou vos droits.',
      'error'
    );
  }
}

function openSiteModal(mode, site) {
  const isEdit = mode === 'edit';

  const regionOptions = REGIONS_SENEGAL.map(
    (r) =>
      `<option value="${r}" ${
        site && site.region === r ? 'selected' : ''
      }>${r}</option>`
  ).join('');

  const content = `
    <form id="site-form" style="display:flex; flex-direction:column; gap:8px;">
      <div>
        <label style="font-size:13px;">Code</label>
        <input name="code" value="${site?.code || ''}" ${
    isEdit ? 'disabled' : ''
  } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
      </div>
      <div>
        <label style="font-size:13px;">Nom</label>
        <input name="nom" value="${site?.nom || ''}" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
      </div>
      <div>
        <label style="font-size:13px;">Région</label>
        <select name="region" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;">
          ${regionOptions}
        </select>
      </div>
      <div>
        <label style="font-size:13px;">Responsable</label>
        <input name="responsable" value="${site?.responsable || ''}" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
      </div>
      <div>
        <label style="font-size:13px;">Téléphone</label>
        <input name="telephone" value="${site?.telephone || ''}" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:4px;">
        <div>
          <label style="font-size:13px;">Heure début</label>
          <input name="heure_debut" type="time" value="${site?.config?.heure_debut || ''}" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
        </div>
        <div>
          <label style="font-size:13px;">Heure retard</label>
          <input name="heure_retard" type="time" value="${site?.config?.heure_retard || ''}" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
        </div>
        <div style="display:flex; align-items:flex-end; gap:4px;">
          <input id="weekend_actif" name="weekend_actif" type="checkbox" ${
            site?.config?.weekend_actif ? 'checked' : ''
          } />
          <label for="weekend_actif" style="font-size:13px;">Weekend actif</label>
        </div>
      </div>
    </form>
  `;

  const title = isEdit ? 'Modifier un site' : 'Ajouter un site';

  showModal({
    title,
    content,
    confirmText: 'Enregistrer',
    cancelText: 'Annuler',
    onConfirm: async (close) => {
      const form = document.getElementById('site-form');
      if (!form) {
        close();
        return;
      }
      const formData = new FormData(form);
      const payload = {
        code: formData.get('code'),
        nom: formData.get('nom'),
        region: formData.get('region'),
        responsable: formData.get('responsable'),
        telephone: formData.get('telephone'),
        config: {
          heure_debut: formData.get('heure_debut'),
          heure_retard: formData.get('heure_retard'),
          weekend_actif: formData.get('weekend_actif') === 'on'
        }
      };

      try {
        if (isEdit && site && site._id) {
          await put(`/api/sites/${site._id}`, payload);
          showToast('Site mis à jour avec succès.', 'success');
        } else {
          await post('/api/sites', payload);
          showToast('Site créé avec succès.', 'success');
        }
        close();
      } catch (err) {
        showToast(
          "Erreur lors de l'enregistrement du site. Vérifiez vos droits et les données.",
          'error'
        );
      }
    }
  });
}

export async function renderSites(root, user) {
  const canEdit = user && user.role === 'superadmin';

  root.innerHTML = `
    <div class="card" style="height:100%; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h2 style="font-size:18px;">Sites</h2>
        ${
          canEdit
            ? '<button id="btn-add-site" class="btn-primary">Ajouter un site</button>'
            : ''
        }
      </div>
      <div style="flex:1; overflow-y:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#f1f8e9;">
              <th style="text-align:left; padding:6px 8px;">Code</th>
              <th style="text-align:left; padding:6px 8px;">Nom</th>
              <th style="text-align:left; padding:6px 8px;">Région</th>
              <th style="text-align:left; padding:6px 8px;">Responsable</th>
              <th style="text-align:left; padding:6px 8px;">Statut</th>
              <th style="text-align:left; padding:6px 8px;">Actions</th>
            </tr>
          </thead>
          <tbody id="sites-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  if (canEdit) {
    const addBtn = root.querySelector('#btn-add-site');
    addBtn.addEventListener('click', () => openSiteModal('create', null));
  }

  const tbody = root.querySelector('#sites-tbody');
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-action');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (!id || !action) return;

    if (action === 'toggle') {
      try {
        const site = await get(`/api/sites`); // reload list to find current
        const sites = site.data || site || [];
        const current = sites.find((s) => s._id === id);
        if (!current) return;
        await put(`/api/sites/${id}`, { actif: !current.actif });
        showToast('Statut du site mis à jour.', 'success');
        fetchSites(root);
      } catch (err) {
        showToast(
          "Erreur lors du changement de statut du site. Vérifiez vos droits.",
          'error'
        );
      }
      return;
    }

    if (action === 'edit') {
      try {
        const res = await get('/api/sites');
        const sites = res.data || res || [];
        const current = sites.find((s) => s._id === id);
        if (!current) return;
        openSiteModal('edit', current);
      } catch (err) {
        showToast(
          "Erreur lors du chargement des informations du site.",
          'error'
        );
      }
    }
  });

  fetchSites(root);
}

