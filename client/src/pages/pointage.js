import { post } from '../api.js';
import { savePointage } from '../store/indexedDB.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

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
  } catch (e) {
    // ignore
  }
}

async function enregistrerPointage(agent, methode) {
  const payload = {
    agent_id: agent._id || agent.id,
    site_id: agent.site_id?._id || agent.site_id,
    methode,
    statut: 'present'
  };

  try {
    if (navigator.onLine) {
      await post('/api/pointages', payload);
    } else {
      await savePointage({
        ...payload,
        sync_status: 'local'
      });
    }
    showToast(
      `✅ ${agent.prenom || ''} ${agent.nom || ''} — Présence enregistrée`,
      'success'
    );
    playBeep();
  } catch (err) {
    showToast(
      "Erreur lors de l'enregistrement du pointage. Il sera réessayé plus tard.",
      'error'
    );
  }
}

async function rechercherAgentParMatricule(matricule) {
  const response = await fetch(
    `/api/agents/search?matricule=${encodeURIComponent(matricule)}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('gds_token') || ''}`
      }
    }
  );
  if (!response.ok) {
    throw new Error('Agent introuvable');
  }
  const data = await response.json();
  return data;
}

function startCamera(video, canvas, onCodeDetected) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'environment' } })
    .then((stream) => {
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.play();

      function tick() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );
          const code = window.jsQR(
            imageData.data,
            imageData.width,
            imageData.height
          );
          if (code && code.data) {
            onCodeDetected(code.data);
          }
        }
        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    })
    .catch(() => {
      showToast(
        'Impossible d’accéder à la caméra. Vérifiez les autorisations.',
        'error'
      );
    });
}

export function renderPointage(root) {
  root.innerHTML = `
    <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap:16px; height:100%;">
      <div class="card" style="display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h2 style="font-size:18px;">Scan QR</h2>
          <button id="btn-start-camera" class="btn-primary">Activer Caméra</button>
        </div>
        <div id="camera-area" style="flex:1; display:flex; align-items:center; justify-content:center; background:#000; border-radius:10px; position:relative; overflow:hidden;">
          <video id="video" style="width:100%; height:auto; transform:scaleX(-1);"></video>
          <canvas id="canvas" style="display:none;"></canvas>
          <div style="position:absolute; border:3px solid #4CAF50; width:60%; height:60%; border-radius:8px;"></div>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="card">
          <h2 style="font-size:16px; margin-bottom:8px;">Ajout manuel</h2>
          <div style="display:flex; gap:8px; margin-bottom:6px;">
            <input id="input-matricule" placeholder="Matricule agent" style="flex:1; padding:8px 10px; border-radius:6px; border:1px solid #cfd8dc;" />
            <button id="btn-search-matricule" class="btn-primary">Rechercher</button>
          </div>
          <div id="manuel-result" style="font-size:13px; color:#455a64;"></div>
        </div>
        <div class="card" style="flex:1; display:flex; flex-direction:column;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h2 style="font-size:16px;">Pointages du jour</h2>
            <span id="badge-pending" class="badge-pending">0 en attente</span>
          </div>
          <div id="liste-pointages" style="flex:1; overflow-y:auto; font-size:13px; max-height:260px;">
            <div style="color:#90a4ae;">Les derniers pointages apparaîtront ici.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const btnCamera = root.querySelector('#btn-start-camera');
  const video = root.querySelector('#video');
  const canvas = root.querySelector('#canvas');
  const inputMatricule = root.querySelector('#input-matricule');
  const btnSearchMatricule = root.querySelector('#btn-search-matricule');
  const manuelResult = root.querySelector('#manuel-result');

  btnCamera.addEventListener('click', () => {
    startCamera(video, canvas, async (matricule) => {
      showToast(`QR détecté : ${matricule}`, 'info');
      try {
        const agent = await rechercherAgentParMatricule(matricule);
        if (!agent) {
          showToast('Agent introuvable pour ce QR.', 'error');
          return;
        }
        const content = `
          <div style="display:flex; gap:10px; align-items:center;">
            <div style="width:60px; height:60px; border-radius:50%; overflow:hidden; background:#eee;">
              ${
                agent.photo
                  ? `<img src="${agent.photo}" style="width:100%; height:100%; object-fit:cover;" />`
                  : ''
              }
            </div>
            <div>
              <div style="font-weight:600;">${agent.prenom || ''} ${
          agent.nom || ''
        }</div>
              <div style="font-size:13px; color:#546e7a;">Matricule ${
                agent.matricule
              }</div>
              <div style="font-size:13px; color:#78909c;">${
                agent.type_contrat || ''
              }</div>
            </div>
          </div>
        `;
        showModal({
          title: 'Confirmer présence',
          content,
          confirmText: 'Confirmer présence',
          cancelText: 'Annuler',
          onConfirm: async (close) => {
            await enregistrerPointage(agent, 'qr_code');
            close();
          }
        });
      } catch (err) {
        showToast(
          "Erreur lors de la récupération de l'agent pour ce QR.",
          'error'
        );
      }
    });
  });

  btnSearchMatricule.addEventListener('click', async () => {
    const value = inputMatricule.value.trim();
    if (!value) {
      showToast('Veuillez saisir un matricule.', 'warning');
      return;
    }

    manuelResult.textContent = 'Recherche en cours...';
    try {
      const agent = await rechercherAgentParMatricule(value);
      if (!agent) {
        manuelResult.textContent = 'Aucun agent trouvé pour ce matricule.';
        return;
      }
      const content = `
        <div style="display:flex; gap:10px; align-items:center;">
          <div style="width:60px; height:60px; border-radius:50%; overflow:hidden; background:#eee;">
            ${
              agent.photo
                ? `<img src="${agent.photo}" style="width:100%; height:100%; object-fit:cover;" />`
                : ''
            }
          </div>
          <div>
            <div style="font-weight:600;">${agent.prenom || ''} ${
        agent.nom || ''
      }</div>
            <div style="font-size:13px; color:#546e7a;">Matricule ${
              agent.matricule
            }</div>
            <div style="font-size:13px; color:#78909c;">${
              agent.type_contrat || ''
            }</div>
          </div>
        </div>
      `;
      showModal({
        title: 'Confirmer présence (manuel)',
        content,
        confirmText: 'Confirmer présence',
        cancelText: 'Annuler',
        onConfirm: async (close) => {
          await enregistrerPointage(agent, 'manuel');
          close();
        }
      });
      manuelResult.textContent = '';
    } catch (err) {
      manuelResult.textContent =
        "Erreur lors de la recherche de l'agent. Veuillez réessayer.";
    }
  });
}

