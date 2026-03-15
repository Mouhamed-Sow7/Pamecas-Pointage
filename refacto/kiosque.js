// client/public/src/pages/kiosque.js
import { showToast } from '../components/toast.js';

let animationId = null;
let isProcessing = false;
let scanFrame = null;
let videoStream = null;

function playBeep(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = success ? 880 : 220;
    osc.type = success ? 'sine' : 'sawtooth';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

function stopScanner() {
  if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
}

function stopCamera() {
  stopScanner();
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
}

// ─── Etats visuels du kiosque ────────────────────────────────────
function setEtat(root, etat, data = {}) {
  const overlay = root.querySelector('#kiosque-overlay');
  const scanGuide = root.querySelector('#scan-guide');

  // Reset
  overlay.style.display = 'none';
  if (scanGuide) scanGuide.style.borderColor = '#4CAF50';

  if (etat === 'scanning') {
    // Etat normal — scan actif
    if (scanGuide) scanGuide.style.borderColor = '#4CAF50';

  } else if (etat === 'loading') {
    // Detection QR — animation chargement
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div style="text-align:center;animation:fadeInUp 0.3s ease;">
        <div class="kiosque-spinner"></div>
        <div style="color:white;font-size:1rem;margin-top:16px;font-weight:500;">Identification...</div>
      </div>
    `;

  } else if (etat === 'succes') {
    // Confirmation agent
    const { agent, type } = data;
    const typeLabel = type === 'depart' ? 'Depart enregistre' : 'Arrivee enregistree';
    const typeIcon = type === 'depart' ? 'fa-right-from-bracket' : 'fa-circle-check';
    const typeBg = type === 'depart' ? '#1565c0' : '#2e7d32';

    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div style="text-align:center;animation:fadeInUp 0.3s ease;">
        <div style="width:80px;height:80px;border-radius:50%;background:${typeBg};display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 0 0 12px rgba(255,255,255,0.15);">
          <i class="fa-solid ${typeIcon}" style="font-size:2rem;color:white;"></i>
        </div>
        <div style="color:white;font-size:1.4rem;font-weight:700;margin-bottom:4px;">${agent.prenom} ${agent.nom}</div>
        <div style="color:rgba(255,255,255,0.8);font-size:0.9rem;margin-bottom:12px;">${agent.matricule || ''}</div>
        <div style="display:inline-flex;align-items:center;gap:8px;background:${typeBg};padding:8px 20px;border-radius:20px;color:white;font-weight:600;font-size:0.95rem;">
          <i class="fa-solid ${typeIcon}"></i> ${typeLabel}
        </div>
        <div style="color:rgba(255,255,255,0.6);font-size:0.8rem;margin-top:16px;" id="kiosque-countdown">Prochain scan dans 3s...</div>
      </div>
    `;

  } else if (etat === 'erreur') {
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div style="text-align:center;animation:fadeInUp 0.3s ease;">
        <div style="width:70px;height:70px;border-radius:50%;background:#c62828;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:1.8rem;color:white;"></i>
        </div>
        <div style="color:white;font-size:1.1rem;font-weight:600;margin-bottom:8px;">${data.message || 'Erreur'}</div>
        <div style="color:rgba(255,255,255,0.6);font-size:0.8rem;" id="kiosque-countdown">Nouvelle tentative dans 3s...</div>
      </div>
    `;

  } else if (etat === 'otp') {
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div style="text-align:center;animation:fadeInUp 0.3s ease;width:100%;max-width:320px;">
        <div style="width:60px;height:60px;border-radius:50%;background:#1565c0;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <i class="fa-solid fa-mobile-screen" style="font-size:1.5rem;color:white;"></i>
        </div>
        <div style="color:white;font-size:1.1rem;font-weight:600;margin-bottom:6px;">Code SMS</div>
        <div style="color:rgba(255,255,255,0.7);font-size:0.82rem;margin-bottom:20px;">Entrez votre matricule puis le code recu par SMS</div>

        <input id="otp-matricule" placeholder="Matricule (ex: SMP-0001)"
          style="width:100%;padding:12px;border-radius:10px;border:none;font-size:1rem;text-align:center;margin-bottom:10px;box-sizing:border-box;background:rgba(255,255,255,0.15);color:white;" />
        <input id="otp-code" placeholder="Code SMS (6 chiffres)"
          style="width:100%;padding:12px;border-radius:10px;border:none;font-size:1.4rem;text-align:center;letter-spacing:0.3em;margin-bottom:16px;box-sizing:border-box;background:rgba(255,255,255,0.15);color:white;" maxlength="6" inputmode="numeric" />

        <div style="display:flex;gap:10px;">
          <button id="otp-cancel" style="flex:1;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.3);background:transparent;color:white;font-size:0.9rem;cursor:pointer;">
            Annuler
          </button>
          <button id="otp-send-btn" style="flex:1;padding:12px;border-radius:10px;border:none;background:#1565c0;color:white;font-size:0.9rem;font-weight:600;cursor:pointer;">
            Envoyer SMS
          </button>
          <button id="otp-verify-btn" style="flex:1;padding:12px;border-radius:10px;border:none;background:#2e7d32;color:white;font-size:0.9rem;font-weight:600;cursor:pointer;display:none;">
            Valider
          </button>
        </div>
        <div id="otp-msg" style="color:rgba(255,255,255,0.7);font-size:0.8rem;margin-top:10px;min-height:20px;"></div>
      </div>
    `;
  }
}

// ─── Countdown auto-reset ────────────────────────────────────────
function startCountdown(root, secondes, onDone) {
  let reste = secondes;
  const el = root.querySelector('#kiosque-countdown');
  const interval = setInterval(() => {
    reste--;
    if (el) el.textContent = reste > 0
      ? `Prochain scan dans ${reste}s...`
      : 'Preparation...';
    if (reste <= 0) {
      clearInterval(interval);
      onDone();
    }
  }, 1000);
}

// ─── Appel API pointage kiosque ──────────────────────────────────
async function enregistrerPointageKiosque(token, agentId, siteId, type) {
  const now = new Date();
  const payload = {
    agent_id: agentId,
    site_id: siteId,
    date: now.toISOString().split('T')[0],
    heure_arrivee: type === 'arrivee' ? now.toTimeString().slice(0,5) : undefined,
    heure_depart: type === 'depart' ? now.toTimeString().slice(0,5) : undefined,
    methode: 'qr_code',
    type
  };
  const res = await fetch('/api/pointages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur pointage');
  return data;
}

// ─── Scanner QR ──────────────────────────────────────────────────
function startScanner(root, video, canvas, token, siteId, onDetected) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  isProcessing = false;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      videoStream = stream;
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
          if (!jsqrFn) return;
          const code = jsqrFn(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            isProcessing = true;
            stopScanner();
            onDetected(code.data);
            return;
          }
        }
        animationId = requestAnimationFrame(scanFrame);
      };
      animationId = requestAnimationFrame(scanFrame);
    })
    .catch(() => {
      setEtat(root, 'erreur', { message: 'Camera inaccessible — utilisez le code SMS' });
    });
}

function resumeScanner(root, video, canvas, token, siteId, onDetected) {
  isProcessing = false;
  setEtat(root, 'scanning');
  animationId = requestAnimationFrame(scanFrame);
}

// ─── Render kiosque ──────────────────────────────────────────────
export async function renderKiosque(root) {
  // Recuperer token et siteId depuis URL hash
  // Format: #/kiosque?token=xxx&site=yyy&nom=Agence
  const hash = window.location.hash;
  const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
  const params = new URLSearchParams(queryStr);
  const token = params.get('token');
  const siteId = params.get('site');
  const siteNom = params.get('nom') ? decodeURIComponent(params.get('nom')) : 'Agence';

  if (!token || !siteId) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f2417;color:white;text-align:center;padding:20px;">
        <div>
          <div style="font-size:3rem;margin-bottom:16px;">⚠️</div>
          <div style="font-size:1.2rem;font-weight:600;margin-bottom:8px;">Kiosque non configure</div>
          <div style="color:rgba(255,255,255,0.6);font-size:0.85rem;">Token ou site manquant dans l'URL</div>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div id="kiosque-page" style="min-height:100vh;background:#0a1a0f;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:20px;">

      <!-- Header -->
      <div style="position:absolute;top:0;left:0;right:0;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.3);z-index:10;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:#2e7d32;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;color:white;font-size:0.8rem;">SP</div>
          <div>
            <div style="color:white;font-weight:700;font-size:0.9rem;">SmartPointage</div>
            <div style="color:rgba(255,255,255,0.6);font-size:0.72rem;">${siteNom}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div id="kiosque-clock" style="color:rgba(255,255,255,0.9);font-size:1rem;font-weight:600;font-variant-numeric:tabular-nums;"></div>
          <div id="kiosque-status" style="width:8px;height:8px;border-radius:50%;background:#4CAF50;"></div>
        </div>
      </div>

      <!-- Camera zone -->
      <div style="position:relative;width:100%;max-width:480px;margin:60px auto 0;">

        <!-- Titre -->
        <div style="text-align:center;margin-bottom:20px;">
          <div style="color:white;font-size:1.3rem;font-weight:700;">Pointage</div>
          <div style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin-top:4px;">Presentez votre QR code</div>
        </div>

        <!-- Video container -->
        <div style="position:relative;width:100%;aspect-ratio:1;border-radius:20px;overflow:hidden;background:#111;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
          <video id="kiosque-video" style="width:100%;height:100%;object-fit:cover;" playsinline></video>
          <canvas id="kiosque-canvas" style="display:none;"></canvas>

          <!-- Cadre de scan anime -->
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
            <div id="scan-guide" style="width:65%;height:65%;position:relative;transition:border-color 0.3s;">
              <div style="position:absolute;top:0;left:0;width:24px;height:24px;border-top:3px solid #4CAF50;border-left:3px solid #4CAF50;border-radius:4px 0 0 0;"></div>
              <div style="position:absolute;top:0;right:0;width:24px;height:24px;border-top:3px solid #4CAF50;border-right:3px solid #4CAF50;border-radius:0 4px 0 0;"></div>
              <div style="position:absolute;bottom:0;left:0;width:24px;height:24px;border-bottom:3px solid #4CAF50;border-left:3px solid #4CAF50;border-radius:0 0 0 4px;"></div>
              <div style="position:absolute;bottom:0;right:0;width:24px;height:24px;border-bottom:3px solid #4CAF50;border-right:3px solid #4CAF50;border-radius:0 0 4px 0;"></div>
              <!-- Ligne de scan animee -->
              <div class="scan-line"></div>
            </div>
          </div>

          <!-- Overlay confirmation/erreur/loading -->
          <div id="kiosque-overlay" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,0.85);display:none;align-items:center;justify-content:center;padding:20px;border-radius:20px;"></div>
        </div>

        <!-- Bouton fallback SMS -->
        <div style="text-align:center;margin-top:20px;">
          <button id="btn-otp-fallback"
            style="padding:10px 24px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:20px;color:rgba(255,255,255,0.7);font-size:0.82rem;cursor:pointer;transition:all 0.2s;">
            <i class="fa-solid fa-mobile-screen"></i> Camera indisponible ? Code SMS
          </button>
        </div>

        <!-- Derniere activite -->
        <div id="last-activity" style="text-align:center;margin-top:16px;color:rgba(255,255,255,0.3);font-size:0.75rem;min-height:20px;"></div>
      </div>
    </div>

    <style>
      .scan-line {
        position: absolute;
        left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #4CAF50, transparent);
        animation: scanAnim 2s linear infinite;
        border-radius: 1px;
      }
      @keyframes scanAnim {
        0% { top: 0; opacity: 1; }
        50% { opacity: 0.6; }
        100% { top: 100%; opacity: 1; }
      }
      .kiosque-spinner {
        width: 56px; height: 56px;
        border: 4px solid rgba(255,255,255,0.2);
        border-top-color: #4CAF50;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #btn-otp-fallback:hover {
        background: rgba(255,255,255,0.15);
        color: white;
      }
    </style>
  `;

  const video = root.querySelector('#kiosque-video');
  const canvas = root.querySelector('#kiosque-canvas');
  const lastActivity = root.querySelector('#last-activity');
  const btnOtp = root.querySelector('#btn-otp-fallback');

  // Horloge
  function updateClock() {
    const el = root.querySelector('#kiosque-clock');
    if (el) el.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Handler detection QR
  async function onQRDetected(matricule) {
    setEtat(root, 'loading');

    try {
      // Chercher l'agent par matricule
      const res = await fetch(`/api/agents/search?matricule=${encodeURIComponent(matricule)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Agent introuvable');
      const agent = await res.json();

      // Verifier si arrivee ou depart
      const dateStr = new Date().toISOString().split('T')[0];
      const resP = await fetch(`/api/pointages?date=${dateStr}&site_id=${siteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataP = await resP.json();
      const pointages = dataP?.data || [];
      const pointageAujourdhui = pointages.find(p =>
        (p.agent_id?._id || p.agent_id)?.toString() === (agent._id || agent.id)?.toString()
      );

      const type = (!pointageAujourdhui || !pointageAujourdhui.heure_arrivee) ? 'arrivee' : 'depart';

      if (type === 'depart' && pointageAujourdhui?.heure_depart) {
        playBeep(false);
        setEtat(root, 'erreur', { message: 'Depart deja enregistre aujourd\'hui' });
        startCountdown(root, 3, () => resumeScanner(root, video, canvas, token, siteId, onQRDetected));
        return;
      }

      // Enregistrer pointage
      await enregistrerPointageKiosque(token, agent._id || agent.id, siteId, type);
      playBeep(true);

      setEtat(root, 'succes', { agent, type });

      // Derniere activite
      const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const typeLabel = type === 'depart' ? 'Depart' : 'Arrivee';
      lastActivity.textContent = `Dernier : ${agent.prenom} ${agent.nom} — ${typeLabel} a ${heure}`;

      startCountdown(root, 3, () => resumeScanner(root, video, canvas, token, siteId, onQRDetected));

    } catch (err) {
      playBeep(false);
      setEtat(root, 'erreur', { message: err.message || 'Erreur inconnue' });
      startCountdown(root, 3, () => resumeScanner(root, video, canvas, token, siteId, onQRDetected));
    }
  }

  // Bouton OTP SMS fallback
  btnOtp.addEventListener('click', () => {
    stopScanner();
    setEtat(root, 'otp');

    setTimeout(() => {
      const btnSend = root.querySelector('#otp-send-btn');
      const btnVerify = root.querySelector('#otp-verify-btn');
      const btnCancel = root.querySelector('#otp-cancel');
      const inputMatricule = root.querySelector('#otp-matricule');
      const inputCode = root.querySelector('#otp-code');
      const otpMsg = root.querySelector('#otp-msg');

      btnCancel.addEventListener('click', () => {
        resumeScanner(root, video, canvas, token, siteId, onQRDetected);
      });

      // Envoyer OTP
      btnSend.addEventListener('click', async () => {
        const matricule = inputMatricule.value.trim();
        if (!matricule) { otpMsg.textContent = 'Entrez votre matricule.'; return; }

        btnSend.disabled = true;
        btnSend.textContent = 'Envoi...';
        otpMsg.textContent = '';

        try {
          const res = await fetch('/api/agents/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ matricule })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);

          otpMsg.textContent = `Code envoye sur ${data.telephone_masque}`;
          otpMsg.style.color = '#a5d6a7';
          btnSend.style.display = 'none';
          btnVerify.style.display = 'block';
          inputCode.focus();
        } catch (err) {
          otpMsg.textContent = err.message || 'Erreur envoi SMS';
          otpMsg.style.color = '#ef9a9a';
          btnSend.disabled = false;
          btnSend.textContent = 'Envoyer SMS';
        }
      });

      // Verifier OTP
      btnVerify.addEventListener('click', async () => {
        const matricule = inputMatricule.value.trim();
        const code = inputCode.value.trim();
        if (!code || code.length !== 6) { otpMsg.textContent = 'Code a 6 chiffres requis.'; return; }

        btnVerify.disabled = true;
        btnVerify.textContent = 'Verification...';

        try {
          const res = await fetch('/api/agents/otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ matricule, code, site_id: siteId })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);

          playBeep(true);
          setEtat(root, 'succes', { agent: data.agent, type: data.type });
          startCountdown(root, 3, () => resumeScanner(root, video, canvas, token, siteId, onQRDetected));
        } catch (err) {
          playBeep(false);
          otpMsg.textContent = err.message || 'Code incorrect ou expire';
          otpMsg.style.color = '#ef9a9a';
          btnVerify.disabled = false;
          btnVerify.textContent = 'Valider';
        }
      });

      // Enter sur input code
      inputCode.addEventListener('keydown', e => { if (e.key === 'Enter') btnVerify.click(); });
    }, 50);
  });

  // Demarrer le scanner
  startScanner(root, video, canvas, token, siteId, onQRDetected);
}
