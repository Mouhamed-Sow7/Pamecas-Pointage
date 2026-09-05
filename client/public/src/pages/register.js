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
  box.style.display = 'block';
}

function validateStep() {
  if (state.step === 1) {
    if (!state.entreprise.nom) return "Le nom de l'entreprise est requis.";
    if (!state.entreprise.email || !state.entreprise.email.includes('@')) return 'Un email valide est requis.';
  } else if (state.step === 2) {
    if (!state.mode) return "Choisissez comment votre organisation fonctionne.";
  } else if (state.step === 3) {
    if ((state.mode === 'agence' || state.mode === 'hybride')) {
      if (state.sites.some((s) => !s.nom || !s.region)) return 'Chaque agence doit avoir un nom et une region.';
    }
    if ((state.mode === 'terrain' || state.mode === 'hybride')) {
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
      <input id="reg-password" class="sp-input" type="password" placeholder="••••••••" value="${state.admin.password}" required />
    </div>
    <div class="sp-field">
      <label class="sp-label" for="reg-password2"><i class="fa-solid fa-lock"></i> Confirmer le mot de passe</label>
      <input id="reg-password2" class="sp-input" type="password" placeholder="••••••••" value="${state.admin.password2}" required />
    </div>
  `;
}

function renderSuccess() {
  return `
    <div class="reg-success">
      <i class="fa-solid fa-circle-check"></i>
      <h3>Compte cree avec succes</h3>
      <p>Votre espace SmartPointage est pret. Connectez-vous avec l'identifiant <strong>${state.createdUsername}</strong>.</p>
      <a href="#/login" class="sp-btn-login" style="display:inline-flex;text-decoration:none;">
        <i class="fa-solid fa-right-to-bracket"></i> Aller a la connexion
      </a>
    </div>
  `;
}

async function renderStep(root) {
  const isFinal = state.step === 5;

  root.innerHTML = `
    <div class="sp-login-page reg-page">
      <div class="sp-bg">
        <div class="sp-bg-circle sp-bg-circle-1"></div>
        <div class="sp-bg-circle sp-bg-circle-2"></div>
      </div>
      <div class="reg-wrap">
        <div class="reg-form-box">
          ${
            isFinal
              ? ''
              : `
            <div class="sp-form-header">
              <h2 class="sp-form-title">Creer votre espace SmartPointage</h2>
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
            <div class="sp-footer-note">
              Deja un compte ? <a href="#/login" style="color:#94a3b8;">Se connecter</a>
            </div>
          `
          }
        </div>
      </div>
    </div>

    <style>
      .reg-page { background: #0f172a; }
      .reg-wrap { width: 100%; max-width: 560px; padding: 24px; z-index: 1; }
      .reg-form-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; }
      .sp-form-title { color: #fff; margin: 0 0 4px; font-size: 1.4rem; }
      .sp-form-subtitle { color: #94a3b8; margin: 0 0 24px; font-size: 0.9rem; }
      .sp-label { display:flex; align-items:center; gap:8px; color:#cbd5e1; font-size:0.85rem; margin-bottom:6px; }
      .sp-field { margin-bottom: 16px; }
      .sp-input { width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:#fff; font-size:0.95rem; }
      .sp-input::placeholder { color:#64748b; }
      .sp-error { background: rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; padding:10px 14px; border-radius:10px; font-size:0.85rem; margin-bottom:16px; }
      .sp-btn-login { width:100%; padding:12px; border:none; border-radius:10px; background:linear-gradient(135deg,#334155,#475569); color:#fff; font-size:0.95rem; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; }
      .sp-btn-login:disabled { opacity:0.6; cursor:default; }
      .sp-footer-note { text-align:center; margin-top:16px; color:#64748b; font-size:0.8rem; }

      .reg-steps { display:flex; justify-content:space-between; margin-bottom:28px; gap:4px; }
      .reg-step { display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; }
      .reg-step-dot { width:26px; height:26px; border-radius:50%; background:rgba(255,255,255,0.08); color:#94a3b8; display:flex; align-items:center; justify-content:center; font-size:0.75rem; }
      .reg-step.active .reg-step-dot { background:#475569; color:#fff; }
      .reg-step.done .reg-step-dot { background:#22c55e; color:#fff; }
      .reg-step-label { font-size:0.65rem; color:#64748b; text-align:center; }
      .reg-step.active .reg-step-label { color:#cbd5e1; }

      .reg-step2-intro { color:#cbd5e1; margin:0 0 16px; font-size:0.9rem; }
      .reg-mode-grid { display:flex; flex-direction:column; gap:12px; margin-bottom:8px; }
      .reg-mode-card { display:flex; flex-direction:column; align-items:flex-start; gap:6px; padding:16px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03); color:#fff; cursor:pointer; text-align:left; }
      .reg-mode-card i { font-size:1.2rem; color:#94a3b8; }
      .reg-mode-card.selected { border-color:#475569; background:rgba(71,85,105,0.25); }
      .reg-mode-card.selected i { color:#cbd5e1; }
      .reg-mode-titre { font-weight:600; font-size:0.95rem; }
      .reg-mode-desc { font-size:0.8rem; color:#94a3b8; }

      .reg-subsection { margin-bottom:20px; }
      .reg-subsection-title { color:#cbd5e1; font-size:0.85rem; margin-bottom:10px; display:flex; align-items:center; gap:8px; }
      .reg-row { display:flex; gap:8px; margin-bottom:8px; }
      .reg-row .sp-input { margin-bottom:0; }
      .reg-row-remove { background:none; border:none; color:#94a3b8; cursor:pointer; font-size:0.9rem; padding:0 6px; }
      .reg-row-add { background:none; border:1px dashed rgba(255,255,255,0.2); color:#94a3b8; border-radius:8px; padding:8px 12px; font-size:0.8rem; cursor:pointer; width:100%; }

      .reg-actions { display:flex; align-items:center; gap:12px; margin-top:8px; }
      .reg-actions .sp-btn-login { flex:1; }
      .reg-btn-secondary { background:none; border:1px solid rgba(255,255,255,0.15); color:#cbd5e1; padding:12px 16px; border-radius:10px; cursor:pointer; font-size:0.9rem; }

      .reg-success { text-align:center; padding:16px 0; }
      .reg-success i { font-size:2.5rem; color:#22c55e; margin-bottom:12px; }
      .reg-success h3 { color:#fff; margin:0 0 8px; }
      .reg-success p { color:#94a3b8; font-size:0.9rem; margin:0 0 20px; }
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
