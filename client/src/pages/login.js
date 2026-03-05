import { post } from '../api.js';
import { saveAuth } from '../store/indexedDB.js';
import { showToast } from '../components/toast.js';

export function renderLogin(root) {
  root.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; height:100vh; background:linear-gradient(135deg,#2E7D32,#4CAF50);">
      <div class="card" style="max-width:420px; width:90%; text-align:center;">
        <div style="margin-bottom:16px;">
          <div style="font-size:28px; font-weight:700; color:#2E7D32;">GDS Pointage</div>
          <div style="font-size:14px; color:#546e7a;">Grands Domaines du Sénégal</div>
        </div>
        <form id="login-form" style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
          <div style="text-align:left;">
            <label for="username" style="font-size:13px; font-weight:500;">Nom d'utilisateur</label>
            <input id="username" name="username" required style="width:100%; margin-top:4px; padding:8px 10px; border-radius:6px; border:1px solid #cfd8dc;" />
          </div>
          <div style="text-align:left;">
            <label for="password" style="font-size:13px; font-weight:500;">Mot de passe</label>
            <input id="password" name="password" type="password" required style="width:100%; margin-top:4px; padding:8px 10px; border-radius:6px; border:1px solid #cfd8dc;" />
          </div>
          <button id="btn-login" type="submit" class="btn-primary" style="margin-top:6px;">
            Se connecter
          </button>
          <div id="login-error" style="min-height:18px; font-size:13px; color:#e53935;"></div>
        </form>
      </div>
    </div>
  `;

  const form = root.querySelector('#login-form');
  const btn = root.querySelector('#btn-login');
  const errorDiv = root.querySelector('#login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Connexion...';

    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      const result = await post('/api/auth/login', { username, password });
      const { token, user } = result;

      localStorage.setItem('gds_token', token);
      localStorage.setItem('gds_user', JSON.stringify(user));
      await saveAuth(token, user);

      showToast('Connexion réussie.', 'success');
      window.location.hash = '#/dashboard';
    } catch (err) {
      const message =
        err && err.message
          ? err.message
          : 'Erreur lors de la tentative de connexion.';
      errorDiv.textContent = message;
      showToast(message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  });
}

