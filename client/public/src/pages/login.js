import { post } from '../api.js';
import { saveAuth } from '../store/indexedDB.js';
import { showToast } from '../components/toast.js';

export function renderLogin(root) {
  root.innerHTML = `
    <div class="login-page">

      <div class="login-pattern"></div>

      <div class="login-container">

        <img src="src/img/logo.png" class="logo" />

        <div class="login-card">

          <h2>Connexion</h2>

          <form id="login-form">

            <div class="input-group">
              <label for="username">Nom d'utilisateur</label>
              <input id="username" name="username" autocomplete="username" placeholder="Nom d'utilisateur" required  />
            </div>

            <div class="input-group">
              <label for="password">Mot de passe</label>
              <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Mot de passe" required />
            </div>

            <button id="btn-login" type="submit" class="btn-login">
              Se connecter
            </button>

            <div id="login-error" class="login-error"></div>

          </form>

        </div>

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
          : 'Erreur lors de la connexion.';

      errorDiv.textContent = message;
      showToast(message, 'error');

    } finally {

      btn.disabled = false;
      btn.textContent = 'Se connecter';

    }
  });
}