import { get, post, put, del } from '../api.js';
import { cacheAgents } from '../store/indexedDB.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('pamecas_user')); } catch { return null; }
}

function renderAgentsList(root, agents) {
  const listContainer = root.querySelector('#agents-list');
  if (!listContainer) return;

  if (!agents || agents.length === 0) {
    listContainer.innerHTML = '<div style="color:#999; text-align:center; padding:20px 10px;">Aucun agent trouvé.</div>';
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
        if (confirm('êtes-vous sûr de vouloir supprimer cet agent ?')) {
          try {
            await del(`/api/agents/${agentId}`);
            showToast('Agent supprimé avec succés.', 'success');
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
    mode === 'edit' ? 'Modifier un agent' : 'Détail agent';

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
            showToast('Agent crée avec succés.', 'success');
          } else if (mode === 'edit') {
            await put(`/api/agents/${agent._id}`, data);
            showToast('Agent mis á  jour avec succés.', 'success');
          }
          close();
          const root = document.getElementById('app').querySelector('main') || document.getElementById('app');
          renderAgents(root, JSON.parse(localStorage.getItem('pamecas_user')));
        } catch (err) {
          showToast("Erreur lors de l'enregistrement de l'agent. Vérifiez les données.", 'error');
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

async function openImportModal(root) {
  let sites = [];
  try {
    const res = await get('/api/sites');
    sites = res.data || res || [];
  } catch {}

  const user = getCurrentUser();
  const defaultSiteId = user?.site_id || '';

  const siteOptions = sites.map(s =>
    `<option value="${s._id}" ${s._id === defaultSiteId ? 'selected' : ''}>${s.nom}</option>`
  ).join('');

  showModal({
    title: 'Importer agents depuis CSV',
    content: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="background:#e3f2fd;border-radius:8px;padding:12px;font-size:0.82rem;color:#1565c0;">
          <i class="fa-solid fa-circle-info"></i>
          Format CSV (separateur virgule ou point-virgule) :<br>
          <code style="background:white;padding:2px 6px;border-radius:4px;font-size:0.78rem;display:block;margin-top:4px;">
            nom;prenom;type_contrat;telephone;poste
          </code>
        </div>
        <div>
          <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:6px;">Agence cible</label>
          <select id="import-site-id" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;">
            <option value="">-- Selectionner une agence --</option>
            ${siteOptions}
          </select>
        </div>
        <div>
          <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:6px;">Fichier CSV</label>
          <input id="import-file" type="file" accept=".csv,.txt"
            style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;background:white;" />
        </div>
        <div id="import-result" style="display:none;padding:10px;border-radius:8px;font-size:0.82rem;"></div>
      </div>
    `,
    confirmText: 'Importer',
    cancelText: 'Annuler',
    onConfirm: async (close) => {
      const file = document.getElementById('import-file')?.files[0];
      const siteId = document.getElementById('import-site-id')?.value;
      const resultDiv = document.getElementById('import-result');

      if (!siteId) { showToast('Selectionnez une agence.', 'warning'); return; }
      if (!file) { showToast('Selectionnez un fichier CSV.', 'warning'); return; }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('site_id', siteId);

      try {
        const token = localStorage.getItem('pamecas_token');
        const res = await fetch('/api/agents/import-csv', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();

        if (res.ok) {
          if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#e8f5e9';
            resultDiv.style.color = '#2e7d32';
            resultDiv.innerHTML = `
              <i class="fa-solid fa-circle-check"></i> ${data.message}
              ${data.errors?.length > 0 ? '<br><small>' + data.errors.join('<br>') + '</small>' : ''}
            `;
          }
          showToast(data.message, 'success');
          setTimeout(() => {
            close();
            window.location.hash = '#/agents';
          }, 1500);
        } else {
          showToast(data.message || 'Erreur import.', 'error');
        }
      } catch (err) {
        showToast('Erreur reseau: ' + err.message, 'error');
      }
    }
  });
}

export async function renderAgents(root, user) {
  const canEdit = user && (user.role === 'admin' || user.role === 'superadmin');

  root.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 style="font-size:1rem;font-weight:600;">Agents</h2>
          ${canEdit ? `
          <div style="display:flex;gap:8px;">
            <button id="btn-import-csv" class="btn-primary" style="background:linear-gradient(135deg,#1565c0,#1976d2);font-size:0.78rem;padding:6px 10px;">
              <i class="fa-solid fa-file-csv"></i> Importer CSV
            </button>
            <button id="btn-qr-sheet" class="btn-primary" style="background:linear-gradient(135deg,#6a1b9a,#8e24aa);font-size:0.78rem;padding:6px 10px;">
              <i class="fa-solid fa-id-card"></i> QR Cards
            </button>
          </div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          <input id="filter-search" placeholder="Recherche par nom, prénom ou matricule" style="width:100%;" />
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

    const btnImportCsv = root.querySelector('#btn-import-csv');
    btnImportCsv.addEventListener('click', () => openImportModal(root));

    const btnQrSheet = root.querySelector('#btn-qr-sheet');
    btnQrSheet.addEventListener('click', async () => {
      const currentUser = getCurrentUser();
      const token = localStorage.getItem('pamecas_token');

      if (currentUser?.site_id) {
        window.open(`/api/agents/qr-sheet/${currentUser.site_id}?token=${token}`, '_blank');
        return;
      }

      // Superadmin — demander quelle agence
      let sites = [];
      try {
        const res = await get('/api/sites');
        sites = res.data || res || [];
      } catch {}

      const siteOptions = sites.map(s =>
        `<option value="${s._id}">${s.nom}</option>`
      ).join('');

      showModal({
        title: 'QR Cards — Choisir une agence',
        content: `
          <div>
            <label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:8px;">Agence</label>
            <select id="qr-site-select" style="width:100%;padding:10px;border:1.5px solid #ddd;border-radius:8px;">
              <option value="">-- Selectionner --</option>
              ${siteOptions}
            </select>
          </div>
        `,
        confirmText: 'Generer QR Cards',
        cancelText: 'Annuler',
        onConfirm: (close) => {
          const siteId = document.getElementById('qr-site-select')?.value;
          if (!siteId) { showToast('Selectionnez une agence.', 'warning'); return; }
          close();
          window.open(`/api/agents/qr-sheet/${siteId}?token=${token}`, '_blank');
        }
      });
    });
  }

  fetchAgents(root, 1);
}
