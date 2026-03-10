import { get, post, put, del } from '../api.js';
import { cacheAgents } from '../store/indexedDB.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

function renderAgentsList(root, agents) {
  const listContainer = root.querySelector('#agents-list');
  if (!listContainer) return;

  if (!agents || agents.length === 0) {
    listContainer.innerHTML = '<div style="color:#999; text-align:center; padding:20px 10px;">Aucun agent trouvÃ©.</div>';
    return;
  }

  let html = '';
  agents.forEach((agent) => {
    const statusColor = {
      'actif': 'badge-present',
      'inactif': 'badge-absent',
      'suspendu': 'badge-retard'
    }[agent.statut] || 'badge-absent';

    html += `
      <div class="card" style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; margin-bottom:4px;">${agent.matricule || agent.numero_employe || 'â€”'}</div>
          <div style="font-size:0.9rem; color:#333; margin-bottom:4px;">${agent.prenom || ''} ${agent.nom || ''}</div>
          <div style="font-size:0.8rem; color:#666; margin-bottom:4px;">
            <div>Type: ${agent.type_contrat || 'â€”'}</div>
            <div>Site: ${agent.site_id?.nom || 'â€”'}</div>
          </div>
          <span class="${statusColor}" style="display:inline-block;">${agent.statut}</span>
        </div>
        <div style="flex:0 0 auto; display:flex; gap:6px;">
          <button class="btn-action" data-id="${agent._id}" data-action="view" style="padding:6px 8px; font-size:0.9rem;"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-action" data-id="${agent._id}" data-action="edit" style="padding:6px 8px; font-size:0.9rem;"><i class="fa-solid fa-pencil"></i></button>
          <button class="btn-action" data-id="${agent._id}" data-action="delete" style="padding:6px 8px; font-size:0.9rem;"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;

  listContainer.querySelectorAll('.btn-action').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const agentId = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const agent = agents.find((a) => a._id === agentId);

      if (action === 'view' || action === 'edit') {
        let sites = [];
        try {
          const res = await get('/api/sites');
          sites = res.data || res || [];
        } catch (err) {}
        openAgentModal(action, agent, sites);
      } else if (action === 'delete') {
        if (confirm('ÃŠtes-vous sÃ»r de vouloir supprimer cet agent ?')) {
          try {
            await del(`/api/agents/${agentId}`);
            showToast('Agent supprimÃ© avec succÃ¨s.', 'success');
            const root = document.getElementById('app').querySelector('main') || document.getElementById('app');
            renderAgents(root, JSON.parse(localStorage.getItem('pamecas_user')));
          } catch (err) {
            showToast("Erreur lors de la suppression de l'agent.", 'error');
          }
        }
      }
    });
  });
}

function renderTable(root, agents) {
  renderAgentsList(root, agents);
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
    showToast("Erreur lors du chargement des agents. Affichage du cache si disponible.", 'warning');
  }
}

function openAgentModal(mode, agent, sites) {
  const isEdit = mode === 'edit';
  const isView = mode === 'view';

  const siteOptions = (sites || [])
    .map(
      (s) =>
        `<option value="${s._id}" ${
          agent && (agent.site_id?._id === s._id || agent.site_id === s._id) ? 'selected' : ''
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
          <label style="font-size:13px;">PrÃ©nom</label>
          <input name="prenom" value="${agent?.prenom || ''}" ${
    isView ? 'disabled' : ''
  } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
        </div>
      </div>
      <div>
        <label style="font-size:13px;">TÃ©lÃ©phone</label>
        <input name="telephone" value="${agent?.telephone || ''}" ${
    isView ? 'disabled' : ''
  } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
      </div>
      <div>
        <label style="font-size:13px;">Site / Agence</label>
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
            <option value="CDI" ${agent?.type_contrat === 'CDI' ? 'selected' : ''}>CDI</option>
            <option value="CDD" ${agent?.type_contrat === 'CDD' ? 'selected' : ''}>CDD</option>
            <option value="stage" ${agent?.type_contrat === 'stage' ? 'selected' : ''}>Stage</option>
            <option value="prestataire" ${agent?.type_contrat === 'prestataire' ? 'selected' : ''}>Prestataire</option>
          </select>
        </div>
        <div>
          <label style="font-size:13px;">Statut</label>
          <select name="statut" ${
            isView ? 'disabled' : ''
          } style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;">
            <option value="actif" ${!agent || agent.statut === 'actif' ? 'selected' : ''}>Actif</option>
            <option value="inactif" ${agent?.statut === 'inactif' ? 'selected' : ''}>Inactif</option>
            <option value="suspendu" ${agent?.statut === 'suspendu' ? 'selected' : ''}>Suspendu</option>
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
        <input name="photo" type="file" accept="image/*" ${isView ? 'disabled' : ''} />
        ${
          agent?.photo
            ? `<div style="margin-top:6px;"><img src="${agent.photo}" style="width:80px; height:80px; border-radius:8px; object-fit:cover;" /></div>`
            : ''
        }
      </div>
      ${
        agent && (agent.matricule || agent.numero_employe)
          ? `<div style="margin-top:6px;">
              <div style="font-size:13px; margin-bottom:4px;">QR Code</div>
              <img id="agent-qr-img" alt="QR" />
            </div>`
          : ''
      }
    </form>
  `;

  const title =
    mode === 'create' ? 'Ajouter un agent' :
    mode === 'edit' ? 'Modifier un agent' : 'DÃ©tail agent';

  showModal({
    title,
    content,
    confirmText: isView ? 'Fermer' : 'Enregistrer',
    cancelText: 'Annuler',
    onConfirm: async (close) => {
      if (isView) { close(); return; }

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
            showToast('Agent crÃ©Ã© avec succÃ¨s.', 'success');
          } else if (mode === 'edit') {
            await put(`/api/agents/${agent._id}`, data);
            showToast('Agent mis Ã  jour avec succÃ¨s.', 'success');
          }
          close();
          const root = document.getElementById('app').querySelector('main') || document.getElementById('app');
          renderAgents(root, JSON.parse(localStorage.getItem('pamecas_user')));
        } catch (err) {
          showToast("Erreur lors de l'enregistrement de l'agent. VÃ©rifiez les donnÃ©es.", 'error');
        }
      }
    }
  });

  if (agent && agent._id) {
    setTimeout(() => {
      const qrImg = document.getElementById('agent-qr-img');
      if (qrImg) {
        get(`/api/agents/${agent._id}/qr`)
          .then((res) => { qrImg.src = `data:image/png;base64,${res.qr_base64}`; })
          .catch(() => {});
      }
    }, 100);
  }
}

export async function renderAgents(root, user) {
  const canEdit = user && (user.role === 'admin' || user.role === 'superadmin');

  root.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="card">
        <h2 style="font-size:1rem; font-weight:600; margin-bottom:12px;">Agents</h2>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          <input id="filter-search" placeholder="Recherche par nom, prÃ©nom ou matricule" style="width:100%;" />
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <select id="filter-type" style="width:100%;">
              <option value="">Type</option>
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="stage">Stage</option>
              <option value="prestataire">Prestataire</option>
            </select>
            <select id="filter-statut" style="width:100%;">
              <option value="">Statut</option>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
              <option value="suspendu">Suspendu</option>
            </select>
          </div>
          <button id="btn-filter-apply" class="btn-large">Filtrer</button>
        </div>
      </div>
      <div id="agents-list" style="display:flex; flex-direction:column; gap:10px;">
        <div style="color:#999; text-align:center; padding:20px 10px;">Chargement...</div>
      </div>
    </div>
    ${canEdit ? `<button id="btn-add-agent" class="fab">+</button>` : ''}
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
      } catch (err) {}
      openAgentModal('create', null, sites);
    });
  }

  fetchAgents(root, 1);
}
