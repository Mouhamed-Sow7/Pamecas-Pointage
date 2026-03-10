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

// ─── Enregistrer arrivée ou départ ──────────────────────────────
async function enregistrerPointage(agent, methode, type = 'arrivee') {
  const now = new Date();
  const user = getCurrentUser();
  const payload = {
    local_id: crypto.randomUUID(),
    agent_id: agent._id || agent.id,
    site_id: agent.site_id?._id || agent.site_id || user?.site_id,
    date: now.toISOString().split('T')[0],
    heure_arrivee: type === 'arrivee' ? now.toTimeString().slice(0, 5) : undefined,
    heure_depart: type === 'depart' ? now.toTimeString().slice(0, 5) : undefined,
    methode,
    type
  };

  try {
    if (navigator.onLine) {
      await post('/api/pointages', payload);
      const label = type === 'depart' ? 'Depart' : 'Arrivee';
      showToast(`${agent.prenom || ''} ${agent.nom || ''} — ${label} enregistree`, 'success');
    } else {
      await savePointage({ ...payload, sync_status: 'local' });
      showToast(`${agent.prenom || ''} ${agent.nom || ''} — Sauvegarde hors ligne`, 'success');
    }
    playBeep();
    return true;
  } catch (err) {
    showToast(err.message || "Erreur lors de l'enregistrement.", 'error');
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

// ─── Tableau pointages : liste scrollable pro ────────────────────
async function reloadPointagesList(container) {
  container.innerHTML = `
    <div style="text-align:center;padding:20px;color:#999;">
      <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
    </div>
  `;
  try {
    const user = getCurrentUser();
    const dateStr = new Date().toISOString().split('T')[0];
    let url = `/api/pointages?date=${dateStr}`;
    if (user?.site_id) url += `&site_id=${user.site_id}`;

    const response = await get(url);
    const pointages = response?.data || [];

    if (!Array.isArray(pointages) || pointages.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:32px 20px;color:#bbb;">
          <i class="fa-regular fa-calendar-xmark" style="font-size:2rem;margin-bottom:8px;display:block;"></i>
          Aucun pointage pour aujourd'hui
        </div>
      `;
      return;
    }

    // Tri alphabetique par nom
    pointages.sort((a, b) => {
      const nomA = `${a.agent_id?.nom || ''} ${a.agent_id?.prenom || ''}`.toLowerCase();
      const nomB = `${b.agent_id?.nom || ''} ${b.agent_id?.prenom || ''}`.toLowerCase();
      return nomA.localeCompare(nomB);
    });

    const admin = isAdmin();

    // Stats rapides
    const presents = pointages.filter(p => p.statut === 'present').length;
    const absents = pointages.filter(p => p.statut === 'absent').length;
    const retards = pointages.filter(p => p.statut === 'retard').length;
    const avecDepart = pointages.filter(p => p.heure_depart).length;

    const statutConfig = {
      present: { color: '#2e7d32', bg: '#e8f5e9', label: 'Present', icon: 'fa-circle-check' },
      absent:  { color: '#c62828', bg: '#ffebee', label: 'Absent',  icon: 'fa-circle-xmark' },
      retard:  { color: '#e65100', bg: '#fff3e0', label: 'Retard',  icon: 'fa-clock' }
    };

    let html = `
      <!-- Stats mini bar -->
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#e8f5e9;border-radius:20px;font-size:0.78rem;color:#2e7d32;font-weight:600;">
          <i class="fa-solid fa-circle-check"></i> ${presents} presents
        </div>
        <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#ffebee;border-radius:20px;font-size:0.78rem;color:#c62828;font-weight:600;">
          <i class="fa-solid fa-circle-xmark"></i> ${absents} absents
        </div>
        <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#fff3e0;border-radius:20px;font-size:0.78rem;color:#e65100;font-weight:600;">
          <i class="fa-solid fa-clock"></i> ${retards} retards
        </div>
        <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#e3f2fd;border-radius:20px;font-size:0.78rem;color:#1565c0;font-weight:600;">
          <i class="fa-solid fa-right-from-bracket"></i> ${avecDepart} partis
        </div>
      </div>

      <!-- Header liste -->
      <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;padding:8px 12px;background:#f5f5f5;border-radius:8px;margin-bottom:4px;font-size:0.72rem;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.04em;">
        <div>Agent</div>
        <div style="text-align:center;">Arrivee</div>
        <div style="text-align:center;">Depart</div>
        ${admin ? '<div style="text-align:center;">Action</div>' : '<div></div>'}
      </div>

      <!-- Liste scrollable -->
      <div style="max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding-right:2px;scrollbar-width:thin;scrollbar-color:#c8e6c9 #f5f5f5;">
    `;

    pointages.forEach(p => {
      const agent = p.agent_id || {};
      const sc = statutConfig[p.statut] || { color: '#555', bg: '#f5f5f5', label: p.statut, icon: 'fa-circle' };
      const methodeIcon = p.methode === 'qr_code' ? 'fa-qrcode' : 'fa-hand-pointer';

      // Durée formatée
      let dureeStr = '';
      if (p.duree_minutes && p.duree_minutes > 0) {
        const h = Math.floor(p.duree_minutes / 60);
        const m = p.duree_minutes % 60;
        dureeStr = h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
      }

      html += `
        <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;padding:10px 12px;background:white;border:1px solid #eee;border-left:3px solid ${sc.color};border-radius:8px;transition:box-shadow 0.15s;"
          onmouseenter="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'"
          onmouseleave="this.style.boxShadow='none'">

          <!-- Nom + statut -->
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
              <span style="font-weight:600;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${agent.nom || ''} ${agent.prenom || ''}
              </span>
              <i class="fa-solid ${methodeIcon}" style="font-size:0.7rem;color:#aaa;flex-shrink:0;"></i>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:0.72rem;color:${sc.color};background:${sc.bg};padding:2px 6px;border-radius:10px;font-weight:500;">
                <i class="fa-solid ${sc.icon}"></i> ${sc.label}
              </span>
              ${p.note ? `<i class="fa-solid fa-note-sticky" style="font-size:0.7rem;color:#ff9800;" title="${p.note}"></i>` : ''}
              <span style="font-size:0.7rem;color:#bbb;">${agent.matricule || ''}</span>
            </div>
          </div>

          <!-- Arrivée -->
          <div style="text-align:center;min-width:52px;">
            ${p.heure_arrivee
              ? `<span style="font-size:0.82rem;font-weight:600;color:#2e7d32;">${p.heure_arrivee}</span>`
              : `<span style="color:#ddd;font-size:0.8rem;">—</span>`
            }
          </div>

          <!-- Départ + durée -->
          <div style="text-align:center;min-width:52px;">
            ${p.heure_depart
              ? `<div style="font-size:0.82rem;font-weight:600;color:#1565c0;">${p.heure_depart}</div>
                 ${dureeStr ? `<div style="font-size:0.68rem;color:#888;">${dureeStr}</div>` : ''}`
              : `<span style="color:#ddd;font-size:0.8rem;">—</span>`
            }
          </div>

          <!-- Action admin -->
          ${admin ? `
          <div style="text-align:center;">
            <button class="btn-edit-pointage"
              data-id="${p._id}"
              data-statut="${p.statut}"
              data-note="${(p.note || '').replace(/"/g, '&quot;')}"
              data-arrivee="${p.heure_arrivee || ''}"
              data-depart="${p.heure_depart || ''}"
              style="width:28px;height:28px;border-radius:50%;border:1.5px solid #1565c0;background:white;color:#1565c0;cursor:pointer;font-size:0.7rem;display:flex;align-items:center;justify-content:center;">
              <i class="fa-solid fa-pen"></i>
            </button>
          </div>` : '<div></div>'}
        </div>
      `;
    });

    html += `</div>`; // fin scroll
    container.innerHTML = html;

    // Event delegation boutons modifier
    if (admin) {
      container.querySelectorAll('.btn-edit-pointage').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(
          btn.dataset.id,
          btn.dataset.statut,
          btn.dataset.note,
          btn.dataset.arrivee,
          btn.dataset.depart,
          container
        ));
      });
    }

  } catch (err) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px;color:#c62828;">
        <i class="fa-solid fa-triangle-exclamation"></i> Erreur lors du chargement
      </div>
    `;
  }
}

// ─── Modal modification admin avec heures ────────────────────────
function openEditModal(id, currentStatut, currentNote, currentArrivee, currentDepart, listePointages) {
  const content = `
    <div style="display:flex;flex-direction:column;gap:14px;">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:5px;color:#444;">Heure arrivee</label>
          <input id="edit-arrivee" type="time" value="${currentArrivee}"
            style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:0.9rem;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:5px;color:#444;">Heure depart</label>
          <input id="edit-depart" type="time" value="${currentDepart}"
            style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:0.9rem;box-sizing:border-box;" />
        </div>
      </div>

      <div>
        <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:5px;color:#444;">Statut</label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;cursor:pointer;font-size:0.82rem;" id="lbl-present">
            <input type="radio" name="edit-statut" value="present" ${currentStatut==='present'?'checked':''} style="accent-color:#2e7d32;">
            <span style="color:#2e7d32;font-weight:500;">Present</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;cursor:pointer;font-size:0.82rem;" id="lbl-absent">
            <input type="radio" name="edit-statut" value="absent" ${currentStatut==='absent'?'checked':''} style="accent-color:#c62828;">
            <span style="color:#c62828;font-weight:500;">Absent</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;cursor:pointer;font-size:0.82rem;" id="lbl-retard">
            <input type="radio" name="edit-statut" value="retard" ${currentStatut==='retard'?'checked':''} style="accent-color:#e65100;">
            <span style="color:#e65100;font-weight:500;">Retard</span>
          </label>
        </div>
      </div>

      <div>
        <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:5px;color:#444;">
          Justification / Note
        </label>
        <textarea id="edit-note" rows="3"
          placeholder="Ex: Absence justifiee — certificat medical, mission externe..."
          style="width:100%;padding:10px;border:1.5px solid #ddd;border-radius:8px;resize:vertical;box-sizing:border-box;font-size:0.85rem;font-family:inherit;">${currentNote}</textarea>
      </div>
    </div>
  `;

  showModal({
    title: 'Modifier le pointage',
    content,
    confirmText: 'Enregistrer',
    cancelText: 'Annuler',
    onConfirm: async (close) => {
      const statut = document.querySelector('input[name="edit-statut"]:checked')?.value;
      const note = document.getElementById('edit-note').value;
      const heure_arrivee = document.getElementById('edit-arrivee').value;
      const heure_depart = document.getElementById('edit-depart').value;

      if (!statut) { showToast('Veuillez selectionner un statut.', 'warning'); return; }

      try {
        const token = localStorage.getItem('pamecas_token');
        const res = await fetch(`/api/pointages/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ statut, note, heure_arrivee, heure_depart })
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Erreur');
        showToast('Pointage mis a jour', 'success');
        await reloadPointagesList(listePointages);
        close();
      } catch (err) {
        showToast(err.message || 'Erreur lors de la mise a jour.', 'error');
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
          if (!jsqrFn) { showToast("jsQR non disponible.", 'error'); return; }
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

      <!-- Pointage Manuel -->
      <div class="card">
        <h2 style="font-size:1rem;font-weight:600;margin-bottom:12px;">
          <i class="fa-solid fa-hand-pointer" style="color:#2e7d32;margin-right:6px;"></i>Pointage Manuel
        </h2>
        <div style="text-align:center;margin-bottom:16px;">
          <div id="current-time" style="font-size:2.2rem;font-weight:700;color:#2E7D32;letter-spacing:0.05em;"></div>
          <div id="current-date" style="font-size:0.85rem;color:#888;margin-top:2px;"></div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input id="input-search" placeholder="Nom ou matricule de l'agent..." style="flex:1;" />
          <button id="btn-search-agent" class="btn-primary" style="flex:0 0 auto;padding:10px 14px;">
            <i class="fa-solid fa-magnifying-glass"></i>
          </button>
        </div>
        <select id="select-agent" style="width:100%;padding:10px;margin-bottom:8px;border:1.5px solid #ddd;border-radius:8px;display:none;font-size:0.9rem;"></select>
        <div id="action-buttons" style="display:none;flex-direction:row;gap:8px;">
          <button id="btn-arrivee" style="flex:1;padding:12px;background:linear-gradient(135deg,#43a047,#2e7d32);color:white;border:none;border-radius:10px;font-size:0.9rem;cursor:pointer;font-weight:600;box-shadow:0 2px 8px rgba(46,125,50,0.3);">
            <i class="fa-solid fa-circle-check"></i> Arrivee
          </button>
          <button id="btn-depart" style="flex:1;padding:12px;background:linear-gradient(135deg,#1976D2,#0d47a1);color:white;border:none;border-radius:10px;font-size:0.9rem;cursor:pointer;font-weight:600;box-shadow:0 2px 8px rgba(21,101,192,0.3);">
            <i class="fa-solid fa-right-from-bracket"></i> Depart
          </button>
        </div>
        <div id="manuel-result" style="font-size:0.82rem;color:#666;margin-top:6px;min-height:20px;"></div>
      </div>

      <!-- Scan QR -->
      <div class="card">
        <details>
          <summary style="cursor:pointer;font-weight:600;padding:4px 0;list-style:none;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-qrcode" style="color:#2e7d32;"></i>
            Scan QR Code
            <i class="fa-solid fa-chevron-down" style="margin-left:auto;font-size:0.75rem;color:#aaa;"></i>
          </summary>
          <div style="margin-top:14px;">
            <button id="btn-start-camera" class="btn-primary" style="width:100%;margin-bottom:12px;">
              <i class="fa-solid fa-camera"></i> Activer la camera
            </button>
            <div style="width:100%;aspect-ratio:4/3;max-height:65vw;background:#111;border-radius:12px;position:relative;overflow:hidden;">
              <video id="video" style="width:100%;height:100%;object-fit:cover;" playsinline></video>
              <canvas id="canvas" style="display:none;"></canvas>
              <!-- Cadre de scan -->
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
                <div style="width:60%;height:60%;position:relative;">
                  <div style="position:absolute;top:0;left:0;width:20px;height:20px;border-top:3px solid #4CAF50;border-left:3px solid #4CAF50;border-radius:3px 0 0 0;"></div>
                  <div style="position:absolute;top:0;right:0;width:20px;height:20px;border-top:3px solid #4CAF50;border-right:3px solid #4CAF50;border-radius:0 3px 0 0;"></div>
                  <div style="position:absolute;bottom:0;left:0;width:20px;height:20px;border-bottom:3px solid #4CAF50;border-left:3px solid #4CAF50;border-radius:0 0 0 3px;"></div>
                  <div style="position:absolute;bottom:0;right:0;width:20px;height:20px;border-bottom:3px solid #4CAF50;border-right:3px solid #4CAF50;border-radius:0 0 3px 0;"></div>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- Pointages du jour -->
      <div class="card" style="padding-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 style="font-size:1rem;font-weight:600;">
            <i class="fa-solid fa-list-check" style="color:#2e7d32;margin-right:6px;"></i>Pointages du jour
          </h2>
          <button id="btn-refresh" style="padding:6px 12px;background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;border-radius:20px;cursor:pointer;font-size:0.78rem;font-weight:500;">
            <i class="fa-solid fa-rotate-right"></i> Actualiser
          </button>
        </div>
        <div id="liste-pointages">
          <div style="text-align:center;padding:20px;color:#999;">Chargement...</div>
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

  // Recherche agents
  btnSearchAgent.addEventListener('click', async () => {
    const query = inputSearch.value.trim();
    if (!query) { manuelResult.textContent = 'Veuillez entrer un nom ou matricule.'; return; }
    manuelResult.textContent = 'Recherche...';
    try {
      const response = await get(`/api/agents?search=${encodeURIComponent(query)}&limit=10`);
      const agents = response?.data || [];
      if (agents.length === 0) {
        manuelResult.textContent = 'Aucun agent trouve.';
        selectAgent.style.display = 'none';
        actionButtons.style.display = 'none';
        return;
      }
      selectAgent.innerHTML = '<option value="">-- Selectionner un agent --</option>';
      agents.forEach(agent => {
        const opt = document.createElement('option');
        opt.value = agent._id;
        opt.textContent = `${agent.nom} ${agent.prenom} — ${agent.matricule || ''}`;
        opt.dataset.agent = JSON.stringify(agent);
        selectAgent.appendChild(opt);
      });
      selectAgent.style.display = 'block';
      actionButtons.style.display = 'none';
      manuelResult.textContent = `${agents.length} agent(s) trouve(s).`;
    } catch { manuelResult.textContent = "Erreur lors de la recherche."; }
  });

  inputSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnSearchAgent.click(); });

  selectAgent.addEventListener('change', async () => {
    if (!selectAgent.value) { actionButtons.style.display = 'none'; return; }

    // Vérifier si l'agent a déjà pointé aujourd'hui pour adapter les boutons
    const selectedOption = selectAgent.options[selectAgent.selectedIndex];
    const agent = JSON.parse(selectedOption.dataset.agent);

    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const res = await get(`/api/pointages?date=${dateStr}&agent_id=${agent._id}`);
      const pointages = res?.data || [];
      const pointageAujourdhui = pointages.find(p =>
        (p.agent_id?._id || p.agent_id) === agent._id ||
        (p.agent_id?._id || p.agent_id)?.toString() === agent._id
      );

      actionButtons.style.display = 'flex';

      if (pointageAujourdhui) {
        // Arrivee deja faite
        btnArrivee.disabled = true;
        btnArrivee.style.opacity = '0.4';
        btnArrivee.title = 'Arrivee deja enregistree';
        // Depart disponible seulement si pas encore fait
        if (pointageAujourdhui.heure_depart) {
          btnDepart.disabled = true;
          btnDepart.style.opacity = '0.4';
          btnDepart.title = 'Depart deja enregistre';
        } else {
          btnDepart.disabled = false;
          btnDepart.style.opacity = '1';
        }
      } else {
        // Pas encore pointe
        btnArrivee.disabled = false;
        btnArrivee.style.opacity = '1';
        btnDepart.disabled = true;
        btnDepart.style.opacity = '0.4';
        btnDepart.title = 'Enregistrez d\'abord l\'arrivee';
      }
    } catch {
      actionButtons.style.display = 'flex';
    }
  });

  async function handlePointageManuel(type) {
    const selectedOption = selectAgent.options[selectAgent.selectedIndex];
    if (!selectedOption?.dataset?.agent) return;
    const agent = JSON.parse(selectedOption.dataset.agent);
    const success = await enregistrerPointage(agent, 'manuel', type);
    if (success) {
      await reloadPointagesList(listePointages);
      // Rafraichir l'etat des boutons
      selectAgent.dispatchEvent(new Event('change'));
    }
  }

  btnArrivee.addEventListener('click', () => { if (!btnArrivee.disabled) handlePointageManuel('arrivee'); });
  btnDepart.addEventListener('click', () => { if (!btnDepart.disabled) handlePointageManuel('depart'); });
  btnRefresh.addEventListener('click', () => reloadPointagesList(listePointages));

  // Camera QR — modal avec choix arrivée/départ
  btnCamera.addEventListener('click', () => {
    isProcessing = false;
    stopScanner();
    startCamera(video, canvas, async (matricule) => {
      showToast(`QR detecte`, 'info');
      try {
        const agent = await rechercherAgentParMatricule(matricule);
        if (!agent) { showToast('Agent introuvable.', 'error'); resumeScanner(); return; }

        // Verifier l'etat du pointage aujourd'hui
        const dateStr = new Date().toISOString().split('T')[0];
        let pointageExistant = null;
        try {
          const res = await get(`/api/pointages?date=${dateStr}`);
          const all = res?.data || [];
          pointageExistant = all.find(p =>
            (p.agent_id?._id || p.agent_id)?.toString() === (agent._id || agent.id)?.toString()
          );
        } catch {}

        const dejaArrive = !!pointageExistant?.heure_arrivee;
        const dejaParti = !!pointageExistant?.heure_depart;

        const modalContent = document.createElement('div');
        modalContent.innerHTML = `
          <div style="display:flex;gap:14px;align-items:center;padding:8px 0;margin-bottom:16px;">
            <div id="mini-qr-btn" style="width:64px;height:64px;border-radius:10px;cursor:pointer;overflow:hidden;border:2px solid #c8e6c9;flex-shrink:0;">
              <img src="/api/agents/${agent._id || agent.id}/qr" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <div>
              <div style="font-weight:700;font-size:1rem;">${agent.nom || ''} ${agent.prenom || ''}</div>
              <div style="color:#666;font-size:0.82rem;">${agent.matricule || ''} — ${agent.type_contrat || ''}</div>
              <div style="color:#888;font-size:0.78rem;">${agent.site_id?.nom || ''}</div>
            </div>
          </div>
          ${dejaArrive ? `
          <div style="background:#e8f5e9;border-radius:8px;padding:10px;font-size:0.82rem;color:#2e7d32;margin-bottom:12px;">
            <i class="fa-solid fa-circle-check"></i> Arrivee enregistree a ${pointageExistant.heure_arrivee}
            ${dejaParti ? ` &nbsp;|&nbsp; <i class="fa-solid fa-right-from-bracket"></i> Depart a ${pointageExistant.heure_depart}` : ''}
          </div>` : ''}
          <div style="display:flex;gap:8px;">
            <button id="qr-btn-arrivee" style="flex:1;padding:11px;background:${dejaArrive?'#eee':'linear-gradient(135deg,#43a047,#2e7d32)'};color:${dejaArrive?'#aaa':'white'};border:none;border-radius:10px;font-size:0.88rem;cursor:${dejaArrive?'not-allowed':'pointer'};font-weight:600;" ${dejaArrive?'disabled':''}>
              <i class="fa-solid fa-circle-check"></i> Arrivee
            </button>
            <button id="qr-btn-depart" style="flex:1;padding:11px;background:${(!dejaArrive||dejaParti)?'#eee':'linear-gradient(135deg,#1976D2,#0d47a1)'};color:${(!dejaArrive||dejaParti)?'#aaa':'white'};border:none;border-radius:10px;font-size:0.88rem;cursor:${(!dejaArrive||dejaParti)?'not-allowed':'pointer'};font-weight:600;" ${(!dejaArrive||dejaParti)?'disabled':''}>
              <i class="fa-solid fa-right-from-bracket"></i> Depart
            </button>
          </div>
        `;

        let modalCloseRef = null;

        showModal({
          title: 'Confirmer le pointage',
          content: modalContent,
          confirmText: null,
          cancelText: 'Annuler',
          onCancel: () => resumeScanner(),
          onReady: (close) => { modalCloseRef = close; }
        });

        setTimeout(() => {
          const miniQr = document.getElementById('mini-qr-btn');
          if (miniQr) miniQr.addEventListener('click', () => showQRModal(agent));

          const btnA = document.getElementById('qr-btn-arrivee');
          const btnD = document.getElementById('qr-btn-depart');

          if (btnA && !btnA.disabled) {
            btnA.addEventListener('click', async () => {
              const success = await enregistrerPointage(agent, 'qr_code', 'arrivee');
              if (success) await reloadPointagesList(listePointages);
              if (modalCloseRef) modalCloseRef();
              resumeScanner();
            });
          }
          if (btnD && !btnD.disabled) {
            btnD.addEventListener('click', async () => {
              const success = await enregistrerPointage(agent, 'qr_code', 'depart');
              if (success) await reloadPointagesList(listePointages);
              if (modalCloseRef) modalCloseRef();
              resumeScanner();
            });
          }
        }, 50);

      } catch {
        showToast("Agent introuvable pour ce QR.", 'error');
        resumeScanner();
      }
    });
  });

  reloadPointagesList(listePointages);
}