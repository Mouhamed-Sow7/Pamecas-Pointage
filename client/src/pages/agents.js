import { get, post, put, del } from '../api.js';
import { cacheAgents } from '../store/indexedDB.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

function renderTable(root, agents) {
  const tbody = root.querySelector('#agents-tbody');
  tbody.innerHTML = '';
  agents.forEach((agent) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${
        agent.numero_employe
      }</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${
        agent.nom
      }</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${
        agent.prenom
      }</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${
        agent.poste || ''
      }</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${
        agent.type_contrat
      }</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${
        agent.site_id?.nom || ''
      }</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">
        <span class="${
          agent.statut === 'actif'
            ? 'badge-present'
            : agent.statut === 'suspendu'
            ? 'badge-retard'
            : 'badge-absent'
        }">${agent.statut}</span>
      </td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">
        <button class="btn-action" data-id="${agent._id}" data-action="view">👁</button>
        <button class="btn-action" data-id="${agent._id}" data-action="edit">✏️</button>
        <button class="btn-action" data-id="${agent._id}" data-action="delete">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function fetchAgents(root, page = 1) {
  const search = root.querySelector('#filter-search').value.trim();
  const type = root.querySelector('#filter-type').value;
  const statut = root.querySelector('#filter-statut').value;

  const params = new URLSearchParams();
  params.append('page', page);
  params.append('limit', 50);
  if (search) params.append('search', search);
  if (type) params.append('type_contrat', type);
  if (statut) params.append('statut', statut);

  try {
    const res = await get(`/api/agents?${params.toString()}`);
    const agents = res.data || [];
    renderTable(root, agents);
    await cacheAgents(agents);
  } catch (err) {
    showToast(
      "Erreur lors du chargement des agents. Affichage du cache si disponible.",
      'warning'
    );
  }
}

function openAgentModal(mode, agent, sites) {
  const isEdit = mode === 'edit';
  const isView = mode === 'view';

  const siteOptions = (sites || [])
    .map(
      (s) =>
        `<option value="${s._id}" ${
          agent && agent.site_id === s._id ? 'selected' : ''
        }>${s.nom}</option>`
    )
    .join('');

  const content = `
    <form id="agent-form" style="display:flex; flex-direction:column; gap:8px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div>
          <label style="font-size:13px;">Nom</label>
          <input name="nom" value="${agent?.nom || ''}" ${
    isView ? 'disabled' : ''
  } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
        </div>
        <div>
          <label style="font-size:13px;">Prénom</label>
          <input name="prenom" value="${agent?.prenom || ''}" ${
    isView ? 'disabled' : ''
  } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
        </div>
      </div>
      <div>
        <label style="font-size:13px;">Téléphone</label>
        <input name="telephone" value="${agent?.telephone || ''}" ${
    isView ? 'disabled' : ''
  } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
      </div>
      <div>
        <label style="font-size:13px;">Site</label>
        <select name="site_id" ${
          isView ? 'disabled' : ''
        } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;">
          ${siteOptions}
        </select>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div>
          <label style="font-size:13px;">Type de contrat</label>
          <select name="type_contrat" ${
            isView ? 'disabled' : ''
          } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;">
            <option value="CDI" ${
              agent?.type_contrat === 'CDI' ? 'selected' : ''
            }>CDI</option>
            <option value="CDD" ${
              agent?.type_contrat === 'CDD' ? 'selected' : ''
            }>CDD</option>
            <option value="stage" ${
              agent?.type_contrat === 'stage' ? 'selected' : ''
            }>Stage</option>
            <option value="prestataire" ${
              agent?.type_contrat === 'prestataire' ? 'selected' : ''
            }>Prestataire</option>
          </select>
        </div>
        <div>
          <label style="font-size:13px;">Statut</label>
          <select name="statut" ${
            isView ? 'disabled' : ''
          } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;">
            <option value="actif" ${
              !agent || agent.statut === 'actif' ? 'selected' : ''
            }>Actif</option>
            <option value="inactif" ${
              agent?.statut === 'inactif' ? 'selected' : ''
            }>Inactif</option>
            <option value="suspendu" ${
              agent?.statut === 'suspendu' ? 'selected' : ''
            }>Suspendu</option>
          </select>
        </div>
      </div>
      <div>
        <label style="font-size:13px;">Poste</label>
        <input name="poste" value="${agent?.poste || ''}" ${
    isView ? 'disabled' : ''
  } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
      </div>
      <div>
        <label style="font-size:13px;">Photo</label>
        <input name="photo" type="file" accept="image/*" ${
          isView ? 'disabled' : ''
        } />
        ${
          agent?.photo
            ? `<div style="margin-top:6px;"><img src="${agent.photo}" style="width:80px; height:80px; border-radius:8px; object-fit:cover;" /></div>`
            : ''
        }
      </div>
      ${
        agent && agent.numero_employe
          ? `<div style="margin-top:6px;">
              <div style="font-size:13px; margin-bottom:4px;">QR Code</div>
              <img id="agent-qr-img" alt="QR" />
            </div>`
          : ''
      }
    </form>
  `;

  const title =
    mode === 'create'
      ? 'Ajouter un agent'
      : mode === 'edit'
      ? 'Modifier un agent'
      : 'Détail agent';

  showModal({
    title,
    content,
    confirmText: isView ? 'Fermer' : 'Enregistrer',
    cancelText: 'Annuler',
    onConfirm: async (close) => {
      if (isView) {
        close();
        return;
      }
      const form = document.getElementById('agent-form');
      const formData = new FormData(form);
      const payload = {
        nom: formData.get('nom'),
        prenom: formData.get('prenom'),
        telephone: formData.get('telephone'),
        site_id: formData.get('site_id'),
        type_contrat: formData.get('type_contrat'),
        statut: formData.get('statut'),
        poste: formData.get('poste')
      };

      const file = form.querySelector('input[name="photo"]').files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          payload.photo = reader.result;
          await save(payload);
        };
        reader.readAsDataURL(file);
      } else {
        await save(payload);
      }

      async function save(data) {
        try {
          if (mode === 'create') {
            await post('/api/agents', data);
            showToast('Agent créé avec succès.', 'success');
          } else if (mode === 'edit') {
            await put(`/api/agents/${agent._id}`, data);
            showToast('Agent mis à jour avec succès.', 'success');
          }
          close();
        } catch (err) {
          showToast(
            "Erreur lors de l'enregistrement de l'agent. Vérifiez les données.",
            'error'
          );
        }
      }
    }
  });

  if (agent && agent._id) {
    const qrImg = document.getElementById('agent-qr-img');
    if (qrImg) {
      get(`/api/agents/${agent._id}/qr`)
        .then((res) => {
          qrImg.src = `data:image/png;base64,${res.qr_base64}`;
        })
        .catch(() => {
          // ignore
        });
    }
  }
}

export async function renderAgents(root, user) {
  const canEdit = user && (user.role === 'admin' || user.role === 'superadmin');

  root.innerHTML = `
    <div class="card" style="height:100%; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h2 style="font-size:18px;">Agents</h2>
        ${
          canEdit
            ? '<button id="btn-add-agent" class="btn-primary">Ajouter un agent</button>'
            : ''
        }
      </div>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <input id="filter-search" placeholder="Recherche (nom, prénom, matricule)" style="flex:1; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
        <select id="filter-type" style="padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;">
          <option value="">Type</option>
          <option value="CDI">CDI</option>
          <option value="CDD">CDD</option>
          <option value="stage">Stage</option>
          <option value="prestataire">Prestataire</option>
        </select>
        <select id="filter-statut" style="padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;">
          <option value="">Statut</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
          <option value="suspendu">Suspendu</option>
        </select>
        <button id="btn-filter-apply" class="btn-primary">Filtrer</button>
      </div>
      <div style="flex:1; overflow-y:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#f1f8e9;">
              <th style="text-align:left; padding:6px 8px;">Matricule</th>
              <th style="text-align:left; padding:6px 8px;">Nom</th>
              <th style="text-align:left; padding:6px 8px;">Prénom</th>
              <th style="text-align:left; padding:6px 8px;">Poste</th>
              <th style="text-align:left; padding:6px 8px;">Type</th>
              <th style="text-align:left; padding:6px 8px;">Site</th>
              <th style="text-align:left; padding:6px 8px;">Statut</th>
              <th style="text-align:left; padding:6px 8px;">Actions</th>
            </tr>
          </thead>
          <tbody id="agents-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const applyBtn = root.querySelector('#btn-filter-apply');
  applyBtn.addEventListener('click', () => fetchAgents(root, 1));

  const searchInput = root.querySelector('#filter-search');
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchAgents(root, 1);
  });

  if (canEdit) {
    const addBtn = root.querySelector('#btn-add-agent');
    addBtn.addEventListener('click', async () => {
      let sites = [];
      try {
        const res = await get('/api/sites');
        sites = res.data || res || [];
      } catch (err) {
        // ignore
      }
      openAgentModal('create', null, sites);
    });
  }

  root.querySelector('#agents-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-action');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (!id || !action) return;

    if (action === 'delete') {
      try {
        await del(`/api/agents/${id}`);
        showToast('Agent désactivé avec succès.', 'success');
        fetchAgents(root, 1);
      } catch (err) {
        showToast(
          "Erreur lors de la désactivation de l'agent. Vérifiez vos droits.",
          'error'
        );
      }
      return;
    }

    try {
      const agent = await get(`/api/agents/${id}`);
      let sites = [];
      try {
        const resSites = await get('/api/sites');
        sites = resSites.data || resSites || [];
      } catch (err) {
        // ignore
      }
      if (action === 'view') {
        openAgentModal('view', agent, sites);
      } else if (action === 'edit') {
        if (!canEdit) {
          showToast("Vous n'avez pas le droit de modifier cet agent.", 'error');
          return;
        }
        openAgentModal('edit', agent, sites);
      }
    } catch (err) {
      showToast(
        "Erreur lors de la récupération des détails de l'agent.",
        'error'
      );
    }
  });

  fetchAgents(root, 1);
}

