import { post, get } from '../api.js';

// ─── Etat du formulaire d'inscription (persiste entre les etapes) ─
const state = {
  step: 1,
  entreprise: { nom: '', email: '', telephone: '' },
  mode: null, // 'agence' | 'terrain' | 'hybride'
  sites: [{ nom: '', region: '' }],
  groupes: [{ nom: '' }],
  admin: { username: '', password: '', password2: '', nom_complet: '' }
};

let regionsCache = null;
async function fetchRegions() {
  if (regionsCache) return regionsCache;
  try {
    const res = await get('/api/auth/regions');
    regionsCache = res.regions || [];
  } catch {
    regionsCache = [];
  }
  return regionsCache;
}

const MODE_INFO = {
  agence: {
    icon: 'fa-building',
    titre: 'Agences fixes',
    desc: 'Une ou plusieurs agences avec un kiosque de pointage sur place.'
  },
  terrain: {
    icon: 'fa-person-walking-arrow-right',
    titre: 'Terrain pur',
    desc: 'Des equipes mobiles (plantation, foret, chantier...) sans kiosque fixe.'
  },
  hybride: {
    icon: 'fa-diagram-project',
    titre: 'Hybride',
    desc: 'Des agences avec kiosque ET des equipes terrain a gerer ensemble.'
  }
};

export function renderRegister(root) {
  renderStep(root);
}

function readStepInputsIntoState(root) {
  const step = state.step;
  if (step === 1) {
    state.entreprise.nom = root.querySelector('#reg-nom')?.value.trim() || '';
    state.entreprise.email = root.querySelector('#reg-email')?.value.trim() || '';
    state.entreprise.telephone = root.querySelector('#reg-tel')?.value.trim() || '';
  } else if (step === 3) {
    if (state.mode === 'agence' || state.mode === 'hybride') {
      state.sites = Array.from(root.querySelectorAll('.reg-site-row')).map((rowEl) => ({
        nom: rowEl.querySelector('.reg-site-nom')?.value.trim() || '',
        region: rowEl.querySelector('.reg-site-region')?.value || ''
      }));
    }
    if (state.mode === 'terrain' || state.mode === 'hybride') {
      state.groupes = Array.from(root.querySelectorAll('.reg-groupe-row')).map((rowEl) => ({
        nom: rowEl.querySelector('.reg-groupe-nom')?.value.trim() || ''
      }));
    }
  } else if (step === 4) {
    state.admin.username = root.querySelector('#reg-username')?.value.trim() || '';
    state.admin.password = root.querySelector('#reg-password')?.value || '';
    state.admin.password2 = root.querySelector('#reg-password2')?.value || '';
    state.admin.nom_complet = root.querySelector('#reg-nomcomplet')?.value.trim() || '';
  }
}

function showError(root, msg) {
  const box = root.querySelector('#reg-error');
  if (!box) return;
  if (!msg) {
    box.style.display = 'none';
    box.textContent = '';
    return;
  }
  box.textContent = msg;
  box.style.display = 'flex';
}

function validateStep() {
  if (state.step === 1) {
    if (!state.entreprise.nom) return "Le nom de l'entreprise est requis.";
    if (!state.entreprise.email || !state.entreprise.email.includes('@')) return 'Un email valide est requis.';
  } else if (state.step === 2) {
    if (!state.mode) return 'Choisissez comment votre organisation fonctionne.';
  } else if (state.step === 3) {
    if (state.mode === 'agence' || state.mode === 'hybride') {
      if (state.sites.some((s) => !s.nom || !s.region)) return 'Chaque agence doit avoir un nom et une region.';
    }
    if (state.mode === 'terrain' || state.mode === 'hybride') {
      if (state.groupes.some((g) => !g.nom)) return 'Chaque groupe terrain doit avoir un nom.';
    }
  } else if (state.step === 4) {
    if (!state.admin.username) return "L'identifiant administrateur est requis.";
    if (!state.admin.password || state.admin.password.length < 6) return 'Le mot de passe doit contenir au moins 6 caracteres.';
    if (state.admin.password !== state.admin.password2) return 'Les mots de passe ne correspondent pas.';
  }
  return null;
}

async function submitRegistration(root) {
  const btn = root.querySelector('#reg-btn-submit');
  const btnText = root.querySelector('#reg-btn-text');
  const btnLoader = root.querySelector('#reg-btn-loader');
  if (btn) btn.disabled = true;
  if (btnText) btnText.style.display = 'none';
  if (btnLoader) btnLoader.style.display = 'inline';

  try {
    const payload = {
      entreprise: state.entreprise,
      mode: state.mode,
      sites: state.mode === 'terrain' ? [] : state.sites,
      groupes: state.mode === 'agence' ? [] : state.groupes,
      admin: {
        username: state.admin.username,
        password: state.admin.password,
        nom_complet: state.admin.nom_complet
      }
    };
    const res = await post('/api/auth/register', payload);
    state.step = 5;
    state.createdUsername = res?.admin?.username || state.admin.username;
    renderStep(root);
  } catch (err) {
    showError(root, err?.message || "L'inscription a echoue. Veuillez reessayer.");
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.style.display = 'inline';
    if (btnLoader) btnLoader.style.display = 'none';
  }
}

function goNext(root) {
  readStepInputsIntoState(root);
  const err = validateStep();
  if (err) {
    showError(root, err);
    return;
  }
  showError(root, null);
  if (state.step === 4) {
    submitRegistration(root);
    return;
  }
  state.step += 1;
  renderStep(root);
}

function goPrev(root) {
  readStepInputsIntoState(root);
  showError(root, null);
  state.step -= 1;
  renderStep(root);
}

function stepIndicator() {
  const labels = ['Entreprise', 'Organisation', 'Structure', 'Compte'];
  return `
    <div class="reg-steps">
      ${labels
        .map((label, i) => {
          const n = i + 1;
          const cls = n === state.step ? 'active' : n < state.step ? 'done' : '';
          return `<div class="reg-step ${cls}"><span class="reg-step-dot">${n < state.step ? '<i class="fa-solid fa-check"></i>' : n}</span><span class="reg-step-label">${label}</span></div>`;
        })
        .join('')}
    </div>
  `;
}

function renderStep1() {
  return `
    <div class="sp-field">
      <label class="sp-label" for="reg-nom"><i class="fa-solid fa-building"></i> Nom de l'entreprise</label>
      <input id="reg-nom" class="sp-input" type="text" placeholder="Ex: Grands Domaines du Senegal" value="${state.entreprise.nom}" required />
    </div>
    <div class="sp-field">
      <label class="sp-label" for="reg-email"><i class="fa-solid fa-envelope"></i> Email de contact</label>
      <input id="reg-email" class="sp-input" type="email" placeholder="contact@entreprise.com" value="${state.entreprise.email}" required />
    </div>
    <div class="sp-field">
      <label class="sp-label" for="reg-tel"><i class="fa-solid fa-phone"></i> Telephone (optionnel)</label>
      <input id="reg-tel" class="sp-input" type="text" placeholder="+221 ..." value="${state.entreprise.telephone}" />
    </div>
  `;
}

function renderStep2() {
  return `
    <p class="reg-step2-intro">Comment votre organisation pointe-t-elle ses agents au quotidien ?</p>
    <div class="reg-mode-grid">
      ${Object.entries(MODE_INFO)
        .map(([key, info]) => `
          <button type="button" class="reg-mode-card ${state.mode === key ? 'selected' : ''}" data-mode="${key}">
            <i class="fa-solid ${info.icon}"></i>
            <div class="reg-mode-titre">${info.titre}</div>
            <div class="reg-mode-desc">${info.desc}</div>
          </button>
        `)
        .join('')}
    </div>
  `;
}

async function renderStep3(root) {
  const needsSites = state.mode === 'agence' || state.mode === 'hybride';
  const needsGroupes = state.mode === 'terrain' || state.mode === 'hybride';
  const regions = needsSites ? await fetchRegions() : [];

  const sitesHtml = needsSites
    ? `
      <div class="reg-subsection">
        <div class="reg-subsection-title"><i class="fa-solid fa-building"></i> Vos agences</div>
        <div id="reg-sites-list">
          ${state.sites
            .map(
              (s, i) => `
            <div class="reg-site-row reg-row">
              <input class="sp-input reg-site-nom" type="text" placeholder="Nom de l'agence" value="${s.nom}" />
              <select class="sp-input reg-site-region">
                <option value="">Region...</option>
                ${regions.map((r) => `<option value="${r}" ${s.region === r ? 'selected' : ''}>${r}</option>`).join('')}
              </select>
              ${state.sites.length > 1 ? `<button type="button" class="reg-row-remove" data-remove-site="${i}"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
        <button type="button" id="reg-add-site" class="reg-row-add"><i class="fa-solid fa-plus"></i> Ajouter une agence</button>
      </div>
    `
    : '';

  const groupesHtml = needsGroupes
    ? `
      <div class="reg-subsection">
        <div class="reg-subsection-title"><i class="fa-solid fa-people-group"></i> Vos groupes terrain</div>
        <div id="reg-groupes-list">
          ${state.groupes
            .map(
              (g, i) => `
            <div class="reg-groupe-row reg-row">
              <input class="sp-input reg-groupe-nom" type="text" placeholder="Ex: Groupe A - Zone Nord" value="${g.nom}" />
              ${state.groupes.length > 1 ? `<button type="button" class="reg-row-remove" data-remove-groupe="${i}"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
        <button type="button" id="reg-add-groupe" class="reg-row-add"><i class="fa-solid fa-plus"></i> Ajouter un groupe</button>
      </div>
    `
    : '';

  return sitesHtml + groupesHtml;
}

function renderStep4() {
  return `
    <div class="sp-field">
      <label class="sp-label" for="reg-nomcomplet"><i class="fa-solid fa-id-card"></i> Votre nom complet</label>
      <input id="reg-nomcomplet" class="sp-input" type="text" placeholder="Prenom Nom" value="${state.admin.nom_complet}" />
    </div>
    <div class="sp-field">
      <label class="sp-label" for="reg-username"><i class="fa-solid fa-user"></i> Identifiant administrateur</label>
      <input id="reg-username" class="sp-input" type="text" placeholder="admin" value="${state.admin.username}" required />
    </div>
    <div class="sp-field">
      <label class="sp-label" for="reg-password"><i class="fa-solid fa-lock"></i> Mot de passe</label>
      <input id="reg-password" class="sp-input" type="password" placeholder="********" value="${state.admin.password}" required />
    </div>
    <div class="sp-field">
      <label class="sp-label" for="reg-password2"><i class="fa-solid fa-lock"></i> Confirmer le mot de passe</label>
      <input id="reg-password2" class="sp-input" type="password" placeholder="********" value="${state.admin.password2}" required />
    </div>
  `;
}

function renderSuccess() {
  return `
    <div class="reg-success">
      <i class="fa-solid fa-circle-check"></i>
      <h3>Compte cree avec succes</h3>
      <p>Votre espace SmartPointage est pret. Connectez-vous avec l'identifiant <strong>${state.createdUsername}</strong>.</p>
      <a href="#/login" class="sp-btn-login" style="display:flex;text-decoration:none;">
        <i class="fa-solid fa-right-to-bracket"></i> Aller a la connexion
      </a>
    </div>
  `;
}

async function renderStep(root) {
  const isFinal = state.step === 5;

  root.innerHTML = `
    <div class="sp-login-page">

      <!-- Fond avec motif geometrique -->
      <div class="sp-bg">
        <div class="sp-bg-circle sp-bg-circle-1"></div>
        <div class="sp-bg-circle sp-bg-circle-2"></div>
        <div class="sp-bg-circle sp-bg-circle-3"></div>
      </div>

      <div class="sp-login-wrap">

        <!-- Panneau gauche branding (desktop) -->
        <div class="sp-brand-panel">
          <div class="sp-brand-logo">
            <div class="sp-brand-mark">SP</div>
          </div>
          <h1 class="sp-brand-name">SmartPointage</h1>
          <p class="sp-brand-tagline">Systeme de pointage digital<br>pour agences et entreprises</p>
          <div class="sp-brand-features">
            <div class="sp-feature"><i class="fa-solid fa-fingerprint"></i> Pointage QR Code</div>
            <div class="sp-feature"><i class="fa-solid fa-wifi"></i> Offline &amp; Online</div>
            <div class="sp-feature"><i class="fa-solid fa-chart-bar"></i> Rapports Excel</div>
            <div class="sp-feature"><i class="fa-solid fa-building"></i> Multi-agences</div>
          </div>
          <div class="sp-brand-client">
            <div class="sp-client-badge"><i class="fa-solid fa-sparkles" style="margin-right:6px;"></i> Nouvel espace client</div>
          </div>
        </div>

        <!-- Panneau droit formulaire -->
        <div class="sp-form-panel">
          <!-- Logo mobile uniquement -->
          <div class="sp-mobile-logo">
            <div class="sp-brand-mark sp-brand-mark-sm">SP</div>
            <div>
              <div class="sp-mobile-title">SmartPointage</div>
              <div class="sp-mobile-sub">Nouvel espace client</div>
            </div>
          </div>

          <div class="sp-form-box">
            ${
              isFinal
                ? ''
                : `
              <div class="sp-form-header">
                <h2 class="sp-form-title">Creer votre espace</h2>
                <p class="sp-form-subtitle">Quelques informations pour configurer votre instance</p>
              </div>
              ${stepIndicator()}
            `
            }

            <div id="reg-step-content"></div>

            <div id="reg-error" class="sp-error" style="display:none;"></div>

            ${
              isFinal
                ? renderSuccess()
                : `
              <div class="reg-actions">
                ${state.step > 1 ? '<button type="button" id="reg-btn-prev" class="reg-btn-secondary"><i class="fa-solid fa-arrow-left"></i> Retour</button>' : '<span></span>'}
                <button type="button" id="reg-btn-submit" class="sp-btn-login">
                  <span id="reg-btn-text">${state.step === 4 ? 'Creer mon compte' : 'Continuer'} <i class="fa-solid fa-arrow-right"></i></span>
                  <span id="reg-btn-loader" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i> Creation...</span>
                </button>
              </div>
            `
            }
          </div>

          <div class="sp-footer-note">
            <div class="sp-footer-links">
              <a href="/"><i class="fa-solid fa-arrow-left"></i> Site web</a>
              <span class="sp-footer-sep">&middot;</span>
              <a href="#/login"><i class="fa-solid fa-right-to-bracket"></i> Deja un compte ? Se connecter</a>
            </div>
            <div class="sp-footer-copy">SmartPointage &copy; 2026 &mdash; Tous droits reserves</div>
          </div>
        </div>
      </div>
    </div>

    <style>
      /* -- Chrome partage avec login.js (memes classes sp-*) ----- */
      .sp-login-page {
        min-height: 100vh;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0f2417;
        position: relative;
        overflow: hidden;
        font-family: 'Inter', sans-serif;
      }
      .sp-bg { position: absolute; inset: 0; pointer-events: none; }
      .sp-bg-circle { position: absolute; border-radius: 50%; opacity: 0.07; background: #4CAF50; }
      .sp-bg-circle-1 { width: 600px; height: 600px; top: -200px; left: -200px; }
      .sp-bg-circle-2 { width: 400px; height: 400px; bottom: -100px; right: -100px; opacity: 0.05; }
      .sp-bg-circle-3 { width: 200px; height: 200px; top: 40%; left: 40%; opacity: 0.04; }

      .sp-login-wrap {
        display: flex;
        width: 100%;
        max-width: 900px;
        min-height: 560px;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(0,0,0,0.5);
        position: relative;
        z-index: 1;
        margin: 16px;
      }

      .sp-brand-panel {
        flex: 1;
        background: linear-gradient(160deg, #1b5e20 0%, #2e7d32 50%, #388e3c 100%);
        padding: 48px 40px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }
      .sp-brand-panel::before {
        content: '';
        position: absolute;
        width: 300px; height: 300px;
        border-radius: 50%;
        background: rgba(255,255,255,0.04);
        top: -80px; right: -80px;
      }
      .sp-brand-panel::after {
        content: '';
        position: absolute;
        width: 200px; height: 200px;
        border-radius: 50%;
        background: rgba(255,255,255,0.03);
        bottom: -60px; left: -60px;
      }
      .sp-brand-logo { margin-bottom: 20px; }
      .sp-brand-mark {
        width: 56px; height: 56px;
        background: white;
        color: #2e7d32;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 1.1rem;
        letter-spacing: -0.5px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      }
      .sp-brand-name { font-size: 1.8rem; font-weight: 800; color: white; margin-bottom: 8px; letter-spacing: -0.5px; }
      .sp-brand-tagline { font-size: 0.88rem; color: rgba(255,255,255,0.7); line-height: 1.6; margin-bottom: 36px; }
      .sp-brand-features { display: flex; flex-direction: column; gap: 12px; margin-bottom: 40px; }
      .sp-feature { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,0.85); font-size: 0.85rem; font-weight: 500; }
      .sp-feature i { width: 20px; color: #a5d6a7; font-size: 0.9rem; }
      .sp-brand-client { margin-top: auto; }
      .sp-client-badge {
        display: inline-flex;
        align-items: center;
        padding: 6px 14px;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 20px;
        color: rgba(255,255,255,0.9);
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.05em;
      }

      .sp-form-panel {
        flex: 0 0 420px;
        background: #ffffff;
        padding: 40px 40px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        max-height: 90vh;
        overflow-y: auto;
      }
      .sp-mobile-logo { display: none; align-items: center; gap: 12px; margin-bottom: 32px; }
      .sp-brand-mark-sm {
        width: 44px; height: 44px; font-size: 0.9rem; border-radius: 10px;
        background: #2e7d32; color: white; display: flex; align-items: center;
        justify-content: center; font-weight: 800;
      }
      .sp-mobile-title { font-size: 1rem; font-weight: 700; color: #1f2933; }
      .sp-mobile-sub { font-size: 0.75rem; color: #888; }

      .sp-form-header { margin-bottom: 22px; }
      .sp-form-title { font-size: 1.4rem; font-weight: 700; color: #1f2933; margin-bottom: 6px; }
      .sp-form-subtitle { font-size: 0.84rem; color: #888; }

      .sp-field { margin-bottom: 16px; }
      .sp-label { display: block; font-size: 0.8rem; font-weight: 600; color: #555; margin-bottom: 6px; }
      .sp-label i { color: #2e7d32; margin-right: 4px; }
      .sp-input {
        width: 100%;
        padding: 11px 14px;
        border: 1.5px solid #e0e0e0;
        border-radius: 10px;
        font-size: 0.92rem;
        font-family: inherit;
        background: #fafafa;
        transition: border-color 0.2s, box-shadow 0.2s;
        box-sizing: border-box;
      }
      .sp-input:focus { outline: none; border-color: #2e7d32; background: white; box-shadow: 0 0 0 3px rgba(46,125,50,0.1); }

      .sp-error {
        background: #ffebee; border: 1px solid #ffcdd2; border-radius: 8px;
        padding: 10px 12px; font-size: 0.82rem; color: #c62828; margin-bottom: 16px;
        align-items: center; gap: 6px;
      }

      .sp-btn-login {
        width: 100%;
        padding: 13px;
        background: linear-gradient(135deg, #2e7d32, #43a047);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 4px 14px rgba(46,125,50,0.3);
        font-family: inherit;
      }
      .sp-btn-login:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(46,125,50,0.4); }
      .sp-btn-login:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

      .sp-footer-note { margin-top: 20px; font-size: 0.72rem; color: #bbb; text-align: center; }
      .sp-footer-links { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px; font-size: 0.75rem; }
      .sp-footer-links a { color: rgba(255,255,255,0.45); text-decoration: none; }
      .sp-footer-links a:hover { color: rgba(255,255,255,0.75); }
      .sp-footer-sep { color: rgba(255,255,255,0.2); }

      @media (max-width: 680px) {
        .sp-login-wrap { flex-direction: column; margin: 0; border-radius: 0; min-height: 100vh; max-width: 100%; }
        .sp-brand-panel { display: none; }
        .sp-form-panel { flex: 1; max-height: none; }
        .sp-mobile-logo { display: flex; }
      }

      /* -- Specifique au wizard register -------------------------- */
      .reg-steps { display:flex; justify-content:space-between; margin-bottom:24px; gap:4px; }
      .reg-step { display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; }
      .reg-step-dot { width:26px; height:26px; border-radius:50%; background:#f0f0f0; color:#999; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:600; }
      .reg-step.active .reg-step-dot { background:#2e7d32; color:#fff; }
      .reg-step.done .reg-step-dot { background:#a5d6a7; color:#1b5e20; }
      .reg-step-label { font-size:0.65rem; color:#aaa; text-align:center; }
      .reg-step.active .reg-step-label { color:#2e7d32; font-weight:600; }

      .reg-step2-intro { color:#555; margin:0 0 14px; font-size:0.88rem; }
      .reg-mode-grid { display:flex; flex-direction:column; gap:10px; margin-bottom:4px; }
      .reg-mode-card { display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:14px; border-radius:10px; border:1.5px solid #e0e0e0; background:#fafafa; cursor:pointer; text-align:left; font-family:inherit; }
      .reg-mode-card i { font-size:1.1rem; color:#888; margin-bottom:2px; }
      .reg-mode-card.selected { border-color:#2e7d32; background:rgba(46,125,50,0.06); }
      .reg-mode-card.selected i { color:#2e7d32; }
      .reg-mode-titre { font-weight:700; font-size:0.9rem; color:#1f2933; }
      .reg-mode-desc { font-size:0.78rem; color:#888; }

      .reg-subsection { margin-bottom:18px; }
      .reg-subsection-title { color:#555; font-size:0.82rem; font-weight:600; margin-bottom:8px; display:flex; align-items:center; gap:8px; }
      .reg-subsection-title i { color:#2e7d32; }
      .reg-row { display:flex; gap:8px; margin-bottom:8px; }
      .reg-row .sp-input { margin-bottom:0; }
      .reg-row-remove { background:none; border:none; color:#bbb; cursor:pointer; font-size:0.9rem; padding:0 6px; }
      .reg-row-remove:hover { color:#c62828; }
      .reg-row-add { background:none; border:1.5px dashed #d0d0d0; color:#888; border-radius:8px; padding:8px 12px; font-size:0.8rem; cursor:pointer; width:100%; font-family:inherit; }
      .reg-row-add:hover { border-color:#2e7d32; color:#2e7d32; }

      .reg-actions { display:flex; align-items:center; gap:12px; margin-top:6px; }
      .reg-actions .sp-btn-login { flex:1; }
      .reg-btn-secondary { background:none; border:1.5px solid #e0e0e0; color:#666; padding:12px 16px; border-radius:10px; cursor:pointer; font-size:0.88rem; font-family:inherit; }
      .reg-btn-secondary:hover { border-color:#bbb; }

      .reg-success { text-align:center; padding:8px 0; }
      .reg-success i { font-size:2.5rem; color:#2e7d32; margin-bottom:12px; }
      .reg-success h3 { color:#1f2933; margin:0 0 8px; }
      .reg-success p { color:#888; font-size:0.88rem; margin:0 0 20px; }
    </style>
  `;

  const contentEl = root.querySelector('#reg-step-content');
  if (contentEl) {
    if (state.step === 1) contentEl.innerHTML = renderStep1();
    else if (state.step === 2) contentEl.innerHTML = renderStep2();
    else if (state.step === 3) contentEl.innerHTML = await renderStep3(root);
    else if (state.step === 4) contentEl.innerHTML = renderStep4();
  }

  attachListeners(root);
}

function attachListeners(root) {
  root.querySelector('#reg-btn-submit')?.addEventListener('click', () => goNext(root));
  root.querySelector('#reg-btn-prev')?.addEventListener('click', () => goPrev(root));

  root.querySelectorAll('.reg-mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.mode = card.getAttribute('data-mode');
      renderStep(root);
    });
  });

  root.querySelector('#reg-add-site')?.addEventListener('click', () => {
    readStepInputsIntoState(root);
    state.sites.push({ nom: '', region: '' });
    renderStep(root);
  });
  root.querySelectorAll('[data-remove-site]').forEach((btn) => {
    btn.addEventListener('click', () => {
      readStepInputsIntoState(root);
      const idx = Number(btn.getAttribute('data-remove-site'));
      state.sites.splice(idx, 1);
      renderStep(root);
    });
  });

  root.querySelector('#reg-add-groupe')?.addEventListener('click', () => {
    readStepInputsIntoState(root);
    state.groupes.push({ nom: '' });
    renderStep(root);
  });
  root.querySelectorAll('[data-remove-groupe]').forEach((btn) => {
    btn.addEventListener('click', () => {
      readStepInputsIntoState(root);
      const idx = Number(btn.getAttribute('data-remove-groupe'));
      state.groupes.splice(idx, 1);
      renderStep(root);
    });
  });
}
