import { post, get } from '../api.js';
import { savePointage } from '../store/indexedDB.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let animationId = null;
let isProcessing = false;
let scanFrame = null; // référence globale pour resumeScanner

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

async function enregistrerPointage(agent, methode, type = 'arrivee') {
  const now = new Date();
  const payload = {
    local_id: crypto.randomUUID(),
    agent_id: agent._id || agent.id,
    site_id: agent.site_id?._id || agent.site_id,
    date: now.toISOString().split('T')[0],
    heure_arrivee: now.toTimeString().slice(0, 5),
    methode,
    type
  };

  try {
    if (navigator.onLine) {
      await post('/api/pointages', payload);
      const action = type === 'depart' ? 'Départ' : 'Arrivée';
      showToast(`✅ ${agent.prenom || ''} ${agent.nom || ''} — ${action} enregistrée`, 'success');
    } else {
      await savePointage({ ...payload, sync_status: 'local' });
      showToast(`📶 ${agent.prenom || ''} ${agent.nom || ''} — Pointage sauvegardé hors ligne`, 'success');
    }
    playBeep();
    return true;
  } catch (err) {
    showToast("Erreur lors de l'enregistrement du pointage.", 'error');
    return false;
  }
}

// ✅ FIX: utilise matricule (pas numero_employe)
async function rechercherAgentParMatricule(matricule) {
  const response = await fetch(
    `/api/agents/search?matricule=${encodeURIComponent(matricule)}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('gds_token') || ''}`
      }
    }
  );
  if (!response.ok) throw new Error('Agent introuvable');
  return await response.json();
}

function stopScanner() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function resumeScanner() {
  isProcessing = false;
  if (scanFrame) {
    animationId = requestAnimationFrame(scanFrame);
  }
}

async function reloadPointagesList(container) {
  try {
    const user = JSON.parse(localStorage.getItem('gds_user'));
    if (!user || !user.site_id) {
      container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Impossible de charger les pointages.</div>';
      return;
    }
    const dateStr = new Date().toISOString().split('T')[0];
    const response = await get(`/api/pointages?site_id=${user.site_id}&date=${dateStr}`);
    const pointages = response?.data || [];

    if (!Array.isArray(pointages) || pointages.length === 0) {
      container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Aucun pointage pour aujourd\'hui.</div>';
      return;
    }

    pointages.sort((a, b) => (a.heure_arrivee || '').localeCompare(b.heure_arrivee || ''));

    let html = `
      <div style="display:flex;font-weight:600;padding:8px;background:#f5f5f5;border-radius:8px;margin-bottom:8px;font-size:0.8rem;">
        <div style="flex:2;">Nom</div>
        <div style="flex:1;">Arrivée</div>
        <div style="flex:1;">Départ</div>
        <div style="flex:1;">Statut</div>
      </div>
    `;
    pointages.forEach(p => {
      const agent = p.agent_id || {};
      const methode = p.methode === 'qr_code' ? '📱' : '✋';
      const statutClass = { present: 'badge-present', absent: 'badge-absent', retard: 'badge-retard' }[p.statut] || 'badge-absent';
      html += `
        <div style="display:flex;align-items:center;padding:10px;border:1px solid #eee;border-radius:8px;font-size:0.85rem;">
          <div style="flex:2;font-weight:500;">${agent.prenom || ''} ${agent.nom || ''} ${methode}</div>
          <div style="flex:1;">${p.heure_arrivee || '—'}</div>
          <div style="flex:1;">${p.heure_depart || '—'}</div>
          <div style="flex:1;"><span class="${statutClass}">${p.statut || '—'}</span></div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div style="color:#c62828;text-align:center;padding:20px;">Erreur lors du chargement.</div>';
  }
}

function startCamera(video, canvas, onCodeDetected) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then((stream) => {
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.play();

      // ✅ FIX: scanFrame défini ici et assigné à la variable globale
      scanFrame = function() {
        // ✅ FIX: si isProcessing, on NE relance PAS la boucle
        if (isProcessing) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          const jsqrFn = window.jsQR || (typeof jsQR === 'function' ? jsQR : null);
          if (!jsqrFn) {
            showToast("jsQR non disponible — rechargez la page.", 'error');
            return;
          }

          const code = jsqrFn(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            // ✅ FIX: stopper AVANT d'appeler onCodeDetected
            isProcessing = true;
            stopScanner();
            onCodeDetected(code.data);
            return; // ne pas continuer la boucle
          }
        }

        // Continuer la boucle seulement si pas de code détecté
        animationId = requestAnimationFrame(scanFrame);
      };

      animationId = requestAnimationFrame(scanFrame);
    })
    .catch(() => {
      showToast("Impossible d'accéder à la caméra. Vérifiez les autorisations.", 'error');
    });
}

export function renderPointage(root) {
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
          <button id="btn-search-agent" class="btn-primary" style="flex:0 0 auto;padding:10px 14px;">Chercher</button>
        </div>
        <select id="select-agent" style="width:100%;padding:10px;margin-bottom:8px;border:1.5px solid #ddd;border-radius:8px;display:none;"></select>
        <div id="action-buttons" style="display:none;flex-direction:row;gap:8px;">
          <button id="btn-arrivee" style="flex:1;padding:11px;background:#4CAF50;color:white;border:none;border-radius:8px;font-size:0.9rem;cursor:pointer;font-weight:500;">✅ Arrivée</button>
          <button id="btn-depart" style="flex:1;padding:11px;background:#1976D2;color:white;border:none;border-radius:8px;font-size:0.9rem;cursor:pointer;font-weight:500;">🚪 Départ</button>
        </div>
        <div id="manuel-result" style="font-size:0.85rem;color:#666;margin-top:6px;"></div>
      </div>

      <div class="card">
        <details>
          <summary style="cursor:pointer;font-weight:600;padding:4px 0;">📷 Scan QR Code</summary>
          <div style="margin-top:12px;">
            <button id="btn-start-camera" class="btn-primary" style="width:100%;margin-bottom:12px;">Activer Caméra</button>
            <div id="camera-area" style="width:100%;aspect-ratio:4/3;max-height:60vw;background:#000;border-radius:10px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;">
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
          <span id="badge-pending" class="badge-pending">0 en attente</span>
        </div>
        <div id="liste-pointages" style="display:flex;flex-direction:column;gap:8px;">
          <div style="color:#999;text-align:center;padding:20px;">Chargement...</div>
        </div>
      </div>
    </div>
  `;

  // Horloge
  function updateClock() {
    const now = new Date();
    const timeEl = root.querySelector('#current-time');
    const dateEl = root.querySelector('#current-date');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);

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

  // Recherche agents
  btnSearchAgent.addEventListener('click', async () => {
    const query = inputSearch.value.trim();
    if (!query) { manuelResult.textContent = 'Veuillez entrer un nom ou matricule.'; return; }
    try {
      const response = await get(`/api/agents?search=${encodeURIComponent(query)}&limit=10`);
      const agents = response?.data || [];
      if (agents.length === 0) {
        manuelResult.textContent = 'Aucun agent trouvé.';
        selectAgent.style.display = 'none';
        actionButtons.style.display = 'none';
        return;
      }
      selectAgent.innerHTML = '<option value="">Sélectionner un agent</option>';
      agents.forEach(agent => {
        const opt = document.createElement('option');
        opt.value = agent._id;
        opt.textContent = `${agent.prenom} ${agent.nom} (${agent.matricule || agent.numero_employe || ''})`;
        opt.dataset.agent = JSON.stringify(agent);
        selectAgent.appendChild(opt);
      });
      selectAgent.style.display = 'block';
      actionButtons.style.display = 'none';
      manuelResult.textContent = `${agents.length} agent(s) trouvé(s).`;
    } catch (err) {
      manuelResult.textContent = "Erreur lors de la recherche.";
    }
  });

  inputSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSearchAgent.click();
  });

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

  // Camera QR
  btnCamera.addEventListener('click', () => {
    isProcessing = false;
    stopScanner();
    startCamera(video, canvas, async (matricule) => {
      showToast(`QR détecté : ${matricule}`, 'info');
      try {
        const agent = await rechercherAgentParMatricule(matricule);
        if (!agent) {
          showToast('Agent introuvable pour ce QR.', 'error');
          resumeScanner();
          return;
        }
        const content = `
          <div style="display:flex;gap:14px;align-items:center;padding:8px 0;">
            <div style="width:56px;height:56px;border-radius:50%;background:#e8f5e9;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">
              ${agent.photo ? `<img src="${agent.photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '👤'}
            </div>
            <div>
              <div style="font-weight:600;font-size:1rem;">${agent.prenom || ''} ${agent.nom || ''}</div>
              <div style="color:#546e7a;font-size:0.85rem;">${agent.matricule || agent.numero_employe || ''}</div>
              <div style="color:#78909c;font-size:0.82rem;">${agent.type_contrat || ''} — ${agent.site_id?.nom || ''}</div>
            </div>
          </div>
        `;
        showModal({
          title: 'Confirmer la présence',
          content,
          confirmText: '✅ Confirmer présence',
          cancelText: 'Annuler',
          onConfirm: async (close) => {
            const success = await enregistrerPointage(agent, 'qr_code', 'arrivee');
            if (success) await reloadPointagesList(listePointages);
            close();
            resumeScanner();
          },
          onCancel: () => resumeScanner()
        });
      } catch (err) {
        showToast("Agent introuvable pour ce QR code.", 'error');
        resumeScanner();
      }
    });
  });

  reloadPointagesList(listePointages);
}