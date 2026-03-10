import { post, get } from '../api.js';
import { savePointage } from '../store/indexedDB.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let animationId = null;
let isProcessing = false;
let scanFrame = null;

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('pamecas_user')); } catch { return null; }
}

function isAdmin() {
  const u = getCurrentUser();
  return u && (u.role === 'admin' || u.role === 'superadmin');
}

async function enregistrerPointage(agent, methode, type = 'arrivee') {
  const now = new Date();
  const user = getCurrentUser();
  const payload = {
    local_id: crypto.randomUUID(),
    agent_id: agent._id || agent.id,
    site_id: agent.site_id?._id || agent.site_id || user?.site_id,
    date: now.toISOString().split('T')[0],
    heure_arrivee: now.toTimeString().slice(0, 5),
    methode,
    type
  };

  try {
    if (navigator.onLine) {
      await post('/api/pointages', payload);
      const action = type === 'depart' ? 'Depart' : 'Arrivee';
      showToast(`OK ${agent.prenom || ''} ${agent.nom || ''} - ${action} enregistree`, 'success');
    } else {
      await savePointage({ ...payload, sync_status: 'local' });
      showToast(`${agent.prenom || ''} ${agent.nom || ''} - Sauvegarde hors ligne`, 'success');
    }
    playBeep();
    return true;
  } catch {
    showToast("Erreur lors de l'enregistrement du pointage.", 'error');
    return false;
  }
}

async function rechercherAgentParMatricule(matricule) {
  const response = await fetch(
    `/api/agents/search?matricule=${encodeURIComponent(matricule)}`,
    { headers: { Authorization: `Bearer ${localStorage.getItem('pamecas_token') || ''}` } }
  );
  if (!response.ok) throw new Error('Agent introuvable');
  return await response.json();
}

function stopScanner() {
  if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
}

function resumeScanner() {
  isProcessing = false;
  if (scanFrame) animationId = requestAnimationFrame(scanFrame);
}

async function reloadPointagesList(container) {
  try {
    const user = getCurrentUser();
    const dateStr = new Date().toISOString().split('T')[0];
    let url = `/api/pointages?date=${dateStr}`;
    if (user?.site_id) url += `&site_id=${user.site_id}`;

    const response = await get(url);
    const pointages = response?.data || [];

    if (!Array.isArray(pointages) || pointages.length === 0) {
      container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Aucun pointage pour aujourd\'hui.</div>';
      return;
    }

    pointages.sort((a, b) => (a.heure_arrivee || '').localeCompare(b.heure_arrivee || ''));

    const admin = isAdmin();
    const statutColors = { present: '#2e7d32', absent: '#c62828', retard: '#e65100' };

    let html = `
      <div style="display:flex;font-weight:600;padding:8px 10px;background:#f5f5f5;border-radius:8px;margin-bottom:6px;font-size:0.78rem;">
        <div style="flex:2;">Agent</div>
        <div style="flex:1;">Arrivee</div>
        <div style="flex:1;">Statut</div>
        ${admin ? '<div style="flex:1;">Action</div>' : ''}
      </div>
    `;

    pointages.forEach(p => {
      const agent = p.agent_id || {};
      const methodeIcon = p.methode === 'qr_code'
        ? '<i class="fa-solid fa-qrcode"></i>'
        : '<i class="fa-solid fa-hand-pointer"></i>';
      const couleur = statutColors[p.statut] || '#555';

      html += `
        <div style="display:flex;align-items:center;padding:10px;border:1px solid #eee;border-radius:8px;font-size:0.82rem;">
          <div style="flex:2;font-weight:500;">
            ${agent.prenom || ''} ${agent.nom || ''} ${methodeIcon}<br>
            <span style="font-size:0.75rem;color:#888;">${p.site_id?.nom || ''}</span>
          </div>
          <div style="flex:1;">${p.heure_arrivee || '-'}</div>
          <div style="flex:1;font-weight:600;color:${couleur};">${p.statut || '-'}</div>
          ${admin ? `<div style="flex:1;">
            <button class="btn-edit-pointage"
              data-id="${p._id}"
              data-statut="${p.statut}"
              data-note="${(p.note || '').replace(/"/g, '&quot;')}"
              style="font-size:0.75rem;padding:4px 8px;background:#1565c0;color:white;border:none;border-radius:6px;cursor:pointer;">
              Modifier
            </button>
          </div>` : ''}
        </div>
      `;
    });

    container.innerHTML = html;

    // Event delegation - pas de onclick inline (CSP)
    if (admin) {
      container.querySelectorAll('.btn-edit-pointage').forEach(btn => {
        btn.addEventListener('click', () => {
          openEditModal(btn.dataset.id, btn.dataset.statut, btn.dataset.note, container);
        });
      });
    }

  } catch {
    container.innerHTML = '<div style="color:#c62828;text-align:center;padding:20px;">Erreur lors du chargement.</div>';
  }
}

function openEditModal(id, currentStatut, currentNote, listePointages) {
  const content = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:4px;">Statut</label>
        <select id="edit-statut" style="width:100%;padding:10px;border:1.5px solid #ddd;border-radius:8px;">
          <option value="present" ${currentStatut==='present'?'selected':''}>Present</option>
          <option value="absent" ${currentStatut==='absent'?'selected':''}>Absent</option>
          <option value="retard" ${currentStatut==='retard'?'selected':''}>Retard</option>
        </select>
      </div>
      <div>
        <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:4px;">Justification / Note</label>
        <textarea id="edit-note" rows="3" placeholder="Ex: Absence justifiee - certificat medical"
          style="width:100%;padding:10px;border:1.5px solid #ddd;border-radius:8px;resize:vertical;box-sizing:border-box;">${currentNote}</textarea>
      </div>
    </div>
  `;
  showModal({
    title: 'Modifier le pointage',
    content,
    confirmText: 'Enregistrer',
    cancelText: 'Annuler',
    onConfirm: async (close) => {
      const statut = document.getElementById('edit-statut').value;
      const note = document.getElementById('edit-note').value;
      try {
        const token = localStorage.getItem('pamecas_token');
        const res = await fetch(`/api/pointages/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ statut, note })
        });
        if (!res.ok) throw new Error();
        showToast('Pointage mis a jour', 'success');
        await reloadPointagesList(listePointages);
        close();
      } catch {
        showToast('Erreur lors de la mise a jour.', 'error');
      }
    }
  });
}

function showQRModal(agent) {
  const qrUrl = `/api/agents/${agent._id || agent.id}/qr`;
  const content = `
    <div style="text-align:center;">
      <div style="font-weight:600;font-size:1rem;margin-bottom:4px;">${agent.prenom} ${agent.nom}</div>
      <div style="color:#666;font-size:0.85rem;margin-bottom:16px;">${agent.matricule || ''}</div>
      <img src="${qrUrl}" alt="QR Code"
        style="width:220px;height:220px;border:2px solid #eee;border-radius:10px;display:block;margin:0 auto 16px;">
      <a href="${qrUrl}" download="qr-${agent.matricule || agent._id}.png"
        style="display:inline-block;padding:10px 20px;background:#2e7d32;color:white;border-radius:8px;text-decoration:none;font-size:0.9rem;">
        <i class="fa-solid fa-download"></i> Telecharger le QR
      </a>
    </div>
  `;
  showModal({ title: 'QR Code agent', content, cancelText: 'Fermer' });
}

function startCamera(video, canvas, onCodeDetected) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then((stream) => {
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.play();

      scanFrame = function () {
        if (isProcessing) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const jsqrFn = window.jsQR || (typeof jsQR === 'function' ? jsQR : null);
          if (!jsqrFn) { showToast("jsQR non disponible - rechargez la page.", 'error'); return; }
          const code = jsqrFn(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
          if (code && code.data) {
            isProcessing = true;
            stopScanner();
            onCodeDetected(code.data);
            return;
          }
        }
        animationId = requestAnimationFrame(scanFrame);
      };

      animationId = requestAnimationFrame(scanFrame);
    })
    .catch(() => showToast("Impossible d'acceder a la camera.", 'error'));
}

export function renderPointage(root) {
  const admin = isAdmin();

  root.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">

      <div class="card">
        <h2 style="font-size:1rem;font-weight:600;margin-bottom:12px;">Pointage Manuel</h2>
        <div style="text-align:center;margin-bottom:16px;">
          <div id="current-time" style="font-size:2rem;font-weight:700;color:#2E7D32;"></div>
          <div id="current-date" style="font-size:0.9rem;color:#666;"></div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input id="input-search" placeholder="Rechercher par nom ou matricule" style="flex:1;" />
          <button id="btn-search-agent" class="btn-primary" style="flex:0 0 auto;padding:10px 14px;">
            <i class="fa-solid fa-magnifying-glass"></i> Chercher
          </button>
        </div>
        <select id="select-agent" style="width:100%;padding:10px;margin-bottom:8px;border:1.5px solid #ddd;border-radius:8px;display:none;"></select>
        <div id="action-buttons" style="display:none;flex-direction:row;gap:8px;">
          <button id="btn-arrivee" style="flex:1;padding:11px;background:#4CAF50;color:white;border:none;border-radius:8px;font-size:0.9rem;cursor:pointer;font-weight:500;">
            <i class="fa-solid fa-circle-check"></i> Arrivee
          </button>
          <button id="btn-depart" style="flex:1;padding:11px;background:#1976D2;color:white;border:none;border-radius:8px;font-size:0.9rem;cursor:pointer;font-weight:500;">
            <i class="fa-solid fa-right-from-bracket"></i> Depart
          </button>
        </div>
        <div id="manuel-result" style="font-size:0.85rem;color:#666;margin-top:6px;"></div>
      </div>

      <div class="card">
        <details>
          <summary style="cursor:pointer;font-weight:600;padding:4px 0;">
            <i class="fa-solid fa-qrcode"></i> Scan QR Code
          </summary>
          <div style="margin-top:12px;">
            <button id="btn-start-camera" class="btn-primary" style="width:100%;margin-bottom:12px;">
              <i class="fa-solid fa-camera"></i> Activer Camera
            </button>
            <div style="width:100%;aspect-ratio:4/3;max-height:60vw;background:#000;border-radius:10px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;">
              <video id="video" style="width:100%;height:100%;object-fit:cover;" playsinline></video>
              <canvas id="canvas" style="display:none;"></canvas>
              <div style="position:absolute;border:3px solid #4CAF50;width:60%;height:60%;border-radius:8px;pointer-events:none;"></div>
            </div>
          </div>
        </details>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 style="font-size:1rem;font-weight:600;">Pointages du jour</h2>
          <button id="btn-refresh" style="padding:5px 10px;background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;border-radius:6px;cursor:pointer;font-size:0.8rem;">
            <i class="fa-solid fa-rotate-right"></i> Actualiser
          </button>
        </div>
        <div id="liste-pointages" style="display:flex;flex-direction:column;gap:8px;">
          <div style="color:#999;text-align:center;padding:20px;">Chargement...</div>
        </div>
      </div>
    </div>
  `;

  function updateClock() {
    const now = new Date();
    const timeEl = root.querySelector('#current-time');
    const dateEl = root.querySelector('#current-date');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  updateClock();
  setInterval(updateClock, 1000);

  const btnSearchAgent = root.querySelector('#btn-search-agent');
  const inputSearch = root.querySelector('#input-search');
  const selectAgent = root.querySelector('#select-agent');
  const actionButtons = root.querySelector('#action-buttons');
  const btnArrivee = root.querySelector('#btn-arrivee');
  const btnDepart = root.querySelector('#btn-depart');
  const manuelResult = root.querySelector('#manuel-result');
  const btnCamera = root.querySelector('#btn-start-camera');
  const video = root.querySelector('#video');
  const canvas = root.querySelector('#canvas');
  const listePointages = root.querySelector('#liste-pointages');
  const btnRefresh = root.querySelector('#btn-refresh');

  btnSearchAgent.addEventListener('click', async () => {
    const query = inputSearch.value.trim();
    if (!query) { manuelResult.textContent = 'Veuillez entrer un nom ou matricule.'; return; }
    try {
      const response = await get(`/api/agents?search=${encodeURIComponent(query)}&limit=10`);
      const agents = response?.data || [];
      if (agents.length === 0) {
        manuelResult.textContent = 'Aucun agent trouve.';
        selectAgent.style.display = 'none';
        actionButtons.style.display = 'none';
        return;
      }
      selectAgent.innerHTML = '<option value="">Selectionner un agent</option>';
      agents.forEach(agent => {
        const opt = document.createElement('option');
        opt.value = agent._id;
        opt.textContent = `${agent.prenom} ${agent.nom} (${agent.matricule || ''})`;
        opt.dataset.agent = JSON.stringify(agent);
        selectAgent.appendChild(opt);
      });
      selectAgent.style.display = 'block';
      actionButtons.style.display = 'none';
      manuelResult.textContent = `${agents.length} agent(s) trouve(s).`;
    } catch { manuelResult.textContent = "Erreur lors de la recherche."; }
  });

  inputSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnSearchAgent.click(); });
  selectAgent.addEventListener('change', () => {
    actionButtons.style.display = selectAgent.value ? 'flex' : 'none';
  });

  async function handlePointageManuel(type) {
    const selectedOption = selectAgent.options[selectAgent.selectedIndex];
    if (!selectedOption?.dataset?.agent) return;
    const agent = JSON.parse(selectedOption.dataset.agent);
    const success = await enregistrerPointage(agent, 'manuel', type);
    if (success) await reloadPointagesList(listePointages);
  }

  btnArrivee.addEventListener('click', () => handlePointageManuel('arrivee'));
  btnDepart.addEventListener('click', () => handlePointageManuel('depart'));
  btnRefresh.addEventListener('click', () => reloadPointagesList(listePointages));

  btnCamera.addEventListener('click', () => {
    isProcessing = false;
    stopScanner();
    startCamera(video, canvas, async (matricule) => {
      showToast(`QR detecte : ${matricule}`, 'info');
      try {
        const agent = await rechercherAgentParMatricule(matricule);
        if (!agent) { showToast('Agent introuvable.', 'error'); resumeScanner(); return; }

        const modalContent = document.createElement('div');
        modalContent.style.cssText = 'display:flex;gap:14px;align-items:center;padding:8px 0;';
        modalContent.innerHTML = `
          <div id="mini-qr-btn" style="width:70px;height:70px;border-radius:10px;background:#e8f5e9;cursor:pointer;flex-shrink:0;overflow:hidden;border:2px solid #c8e6c9;">
            <img src="/api/agents/${agent._id || agent.id}/qr" style="width:100%;height:100%;object-fit:cover;" title="Cliquer pour agrandir">
          </div>
          <div>
            <div style="font-weight:600;font-size:1rem;">${agent.prenom || ''} ${agent.nom || ''}</div>
            <div style="color:#546e7a;font-size:0.85rem;">${agent.matricule || ''}</div>
            <div style="color:#78909c;font-size:0.82rem;">${agent.type_contrat || ''} - ${agent.site_id?.nom || ''}</div>
          </div>
        `;

        showModal({
          title: 'Confirmer la presence',
          content: modalContent,
          confirmText: 'Confirmer presence',
          cancelText: 'Annuler',
          onConfirm: async (close) => {
            const success = await enregistrerPointage(agent, 'qr_code', 'arrivee');
            if (success) await reloadPointagesList(listePointages);
            close();
            resumeScanner();
          },
          onCancel: () => resumeScanner()
        });

        setTimeout(() => {
          const miniQr = document.getElementById('mini-qr-btn');
          if (miniQr) miniQr.addEventListener('click', () => showQRModal(agent));
        }, 50);

      } catch {
        showToast("Agent introuvable pour ce QR code.", 'error');
        resumeScanner();
      }
    });
  });

  reloadPointagesList(listePointages);
}