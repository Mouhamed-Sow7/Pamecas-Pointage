import { post } from '../api.js';
import { saveAuth } from '../store/indexedDB.js';
import { showToast } from '../components/toast.js';

export function renderLogin(root) {
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
            <div class="sp-feature"><i class="fa-solid fa-qrcode"></i> Pointage QR Code</div>
            <div class="sp-feature"><i class="fa-solid fa-wifi"></i> Offline &amp; Online</div>
            <div class="sp-feature"><i class="fa-solid fa-chart-bar"></i> Rapports Excel</div>
            <div class="sp-feature"><i class="fa-solid fa-building"></i> Multi-agences</div>
          </div>
          <div class="sp-brand-client">
            <div class="sp-client-badge">Instance PAMECAS</div>
          </div>
        </div>

        <!-- Panneau droit formulaire -->
        <div class="sp-form-panel">
          <!-- Logo mobile uniquement -->
          <div class="sp-mobile-logo">
            <div class="sp-brand-mark sp-brand-mark-sm">SP</div>
            <div>
              <div class="sp-mobile-title">SmartPointage</div>
              <div class="sp-mobile-sub">Instance PAMECAS</div>
            </div>
          </div>

          <div class="sp-form-box">
            <div class="sp-form-header">
              <h2 class="sp-form-title">Connexion</h2>
              <p class="sp-form-subtitle">Entrez vos identifiants pour acceder</p>
            </div>

            <form id="login-form" autocomplete="on">
              <div class="sp-field">
                <label class="sp-label" for="username">
                  <i class="fa-solid fa-user"></i> Identifiant
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  class="sp-input"
                  autocomplete="username"
                  placeholder="votre identifiant"
                  required
                />
              </div>

              <div class="sp-field">
                <label class="sp-label" for="password">
                  <i class="fa-solid fa-lock"></i> Mot de passe
                </label>
                <div class="sp-input-wrap">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    class="sp-input"
                    autocomplete="current-password"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" id="btn-toggle-pwd" class="sp-pwd-toggle" tabindex="-1">
                    <i class="fa-regular fa-eye" id="pwd-icon"></i>
                  </button>
                </div>
              </div>

              <div id="login-error" class="sp-error" style="display:none;"></div>

              <button id="btn-login" type="submit" class="sp-btn-login">
                <span id="btn-text"><i class="fa-solid fa-right-to-bracket"></i> Se connecter</span>
                <span id="btn-loader" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i> Connexion...</span>
              </button>
            </form>
          </div>

          <div class="sp-footer-note">
            SmartPointage &copy; 2026 &mdash; Tous droits reserves
          </div>
        </div>
      </div>
    </div>

    <style>
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

      /* Cercles de fond */
      .sp-bg { position: absolute; inset: 0; pointer-events: none; }
      .sp-bg-circle {
        position: absolute;
        border-radius: 50%;
        opacity: 0.07;
        background: #4CAF50;
      }
      .sp-bg-circle-1 { width: 600px; height: 600px; top: -200px; left: -200px; }
      .sp-bg-circle-2 { width: 400px; height: 400px; bottom: -100px; right: -100px; opacity: 0.05; }
      .sp-bg-circle-3 { width: 200px; height: 200px; top: 40%; left: 40%; opacity: 0.04; }

      /* Wrap principal */
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

      /* Panneau branding gauche */
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
      .sp-brand-name {
        font-size: 1.8rem;
        font-weight: 800;
        color: white;
        margin-bottom: 8px;
        letter-spacing: -0.5px;
      }
      .sp-brand-tagline {
        font-size: 0.88rem;
        color: rgba(255,255,255,0.7);
        line-height: 1.6;
        margin-bottom: 36px;
      }
      .sp-brand-features {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 40px;
      }
      .sp-feature {
        display: flex;
        align-items: center;
        gap: 10px;
        color: rgba(255,255,255,0.85);
        font-size: 0.85rem;
        font-weight: 500;
      }
      .sp-feature i {
        width: 20px;
        color: #a5d6a7;
        font-size: 0.9rem;
      }
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

      /* Panneau formulaire */
      .sp-form-panel {
        flex: 0 0 400px;
        background: #ffffff;
        padding: 48px 40px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .sp-mobile-logo {
        display: none;
        align-items: center;
        gap: 12px;
        margin-bottom: 32px;
      }
      .sp-brand-mark-sm {
        width: 44px; height: 44px;
        font-size: 0.9rem;
        border-radius: 10px;
        background: #2e7d32;
        color: white;
      }
      .sp-mobile-title { font-size: 1rem; font-weight: 700; color: #1f2933; }
      .sp-mobile-sub { font-size: 0.75rem; color: #888; }

      .sp-form-header { margin-bottom: 28px; }
      .sp-form-title {
        font-size: 1.4rem;
        font-weight: 700;
        color: #1f2933;
        margin-bottom: 6px;
      }
      .sp-form-subtitle { font-size: 0.84rem; color: #888; }

      .sp-field { margin-bottom: 18px; }
      .sp-label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        color: #555;
        margin-bottom: 6px;
      }
      .sp-label i { color: #2e7d32; margin-right: 4px; }

      .sp-input-wrap { position: relative; }
      .sp-input {
        width: 100%;
        padding: 12px 14px;
        border: 1.5px solid #e0e0e0;
        border-radius: 10px;
        font-size: 0.92rem;
        font-family: inherit;
        background: #fafafa;
        transition: border-color 0.2s, box-shadow 0.2s;
        box-sizing: border-box;
      }
      .sp-input:focus {
        outline: none;
        border-color: #2e7d32;
        background: white;
        box-shadow: 0 0 0 3px rgba(46,125,50,0.1);
      }
      .sp-input-wrap .sp-input { padding-right: 44px; }
      .sp-pwd-toggle {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        color: #aaa;
        font-size: 0.9rem;
        padding: 4px;
      }
      .sp-pwd-toggle:hover { color: #2e7d32; }

      .sp-error {
        background: #ffebee;
        border: 1px solid #ffcdd2;
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 0.82rem;
        color: #c62828;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 6px;
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
        transition: transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 4px 14px rgba(46,125,50,0.3);
        font-family: inherit;
        margin-top: 4px;
      }
      .sp-btn-login:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(46,125,50,0.4);
      }
      .sp-btn-login:active { transform: scale(0.98); }
      .sp-btn-login:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

      .sp-footer-note {
        margin-top: 24px;
        font-size: 0.72rem;
        color: #bbb;
        text-align: center;
      }

      /* MOBILE */
      @media (max-width: 680px) {
        .sp-login-wrap {
          flex-direction: column;
          margin: 0;
          border-radius: 0;
          min-height: 100vh;
        }
        .sp-brand-panel { display: none; }
        .sp-form-panel {
          flex: 1;
          padding: 32px 24px;
          justify-content: flex-start;
          padding-top: 48px;
        }
        .sp-mobile-logo { display: flex; }
      }
    </style>
  `;

  // Toggle password visibility
  const btnToggle = root.querySelector('#btn-toggle-pwd');
  const pwdInput = root.querySelector('#password');
  const pwdIcon = root.querySelector('#pwd-icon');
  btnToggle?.addEventListener('click', () => {
    const isHidden = pwdInput.type === 'password';
    pwdInput.type = isHidden ? 'text' : 'password';
    pwdIcon.className = isHidden ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
  });

  // Form submit
  const form = root.querySelector('#login-form');
  const btn = root.querySelector('#btn-login');
  const btnText = root.querySelector('#btn-text');
  const btnLoader = root.querySelector('#btn-loader');
  const errorDiv = root.querySelector('#login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';

    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      const result = await post('/api/auth/login', { username, password });
      const { token, user } = result;
      localStorage.setItem('pamecas_token', token);
      localStorage.setItem('pamecas_user', JSON.stringify(user));
      await saveAuth(token, user);
      showToast('Connexion reussie.', 'success');
      window.location.hash = '#/dashboard';
    } catch (err) {
      const message = err?.message || 'Erreur lors de la connexion.';
      errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message}`;
      errorDiv.style.display = 'flex';
    } finally {
      btn.disabled = false;
      btnText.style.display = 'inline';
      btnLoader.style.display = 'none';
    }
  });
}