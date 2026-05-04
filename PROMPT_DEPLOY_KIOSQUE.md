# SmartPointage — Déploiement kiosque par tablette

## Contexte
Lire app.js, sites.js (client), kiosque.js avant de modifier.

---

## MISSION 1 — Détection mode kiosque au démarrage

### client/public/src/app.js
Tout au début de la fonction `router()`, AVANT tout le reste, ajouter :

```javascript
function router() {
  updateOfflineBanner();

  // ── Mode kiosque permanent ─────────────────────────────────
  const kiosqueToken = localStorage.getItem('kiosque_mode');
  if (kiosqueToken) {
    const app = document.getElementById('app');
    if (!app) return;
    // Forcer plein écran si possible
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    app.className = '';
    app.innerHTML = '';
    // Passer le token kiosque directement à renderKiosque via URL simulée
    window._kiosqueToken = kiosqueToken;
    window._kiosqueSiteNom = localStorage.getItem('kiosque_nom') || 'Agence';
    renderKiosque(app);
    return;
  }
  // ── Fin détection kiosque ──────────────────────────────────

  const hash = window.location.hash || '#/dashboard';
  const route = hash.replace('#', '').split('?')[0] || '/dashboard';
  // ... reste du router inchangé
}
```

### client/public/src/pages/kiosque.js
Modifier `renderKiosque` pour lire aussi `window._kiosqueToken` :

```javascript
export async function renderKiosque(root) {
  const hash = window.location.hash;
  const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
  const params = new URLSearchParams(queryStr);

  // Mode déploiement tablette (priorité) ou URL directe
  const token = window._kiosqueToken || params.get('ktoken') || params.get('token');
  const siteNom = window._kiosqueSiteNom || params.get('nom')
    ? decodeURIComponent(params.get('nom') || '')
    : 'Agence';

  // Résoudre site_id depuis token kiosque si ktoken
  let siteId = params.get('site');
  if (!siteId && token && !params.get('token')) {
    // C'est un ktoken UUID — appeler /api/auth/kiosque/:token
    try {
      const res = await fetch(`/api/auth/kiosque/${token}`);
      if (res.ok) {
        const data = await res.json();
        siteId = data.site._id;
        // Mettre à jour le nom si pas déjà set
        if (!window._kiosqueSiteNom) window._kiosqueSiteNom = data.site.nom;
      }
    } catch {}
  }
  // ... reste du code inchangé, utiliser token et siteId
}
```

---

## MISSION 2 — Bouton "Déployer sur cette tablette" dans Agences

### client/public/src/pages/sites.js
Dans `renderTable`, ajouter un bouton "Déployer" dans la colonne Kiosque :

```javascript
// Dans la cellule kiosque, après le bouton "Copier URL", ajouter :
${site.kiosque_token ? `
  <button class="btn-deploy-kiosque"
    data-token="${site.kiosque_token}"
    data-nom="${site.nom}"
    data-site="${site._id}"
    style="display:flex;align-items:center;gap:5px;padding:5px 10px;margin-top:6px;border-radius:8px;border:none;background:linear-gradient(135deg,#1b5e20,#2e7d32);color:white;cursor:pointer;font-size:0.75rem;font-weight:600;width:100%;">
    <i class="fa-solid fa-tablet-screen-button"></i> Deployer kiosque
  </button>
` : ''}
```

Ajouter dans le event delegation de `tbody` :

```javascript
const btnDeploy = e.target.closest('.btn-deploy-kiosque');
if (btnDeploy) {
  const { token, nom, site } = btnDeploy.dataset;

  showModal({
    title: '🖥️ Deployer le kiosque',
    content: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="background:#e8f5e9;border-radius:10px;padding:14px;text-align:center;">
          <i class="fa-solid fa-tablet-screen-button" style="font-size:2rem;color:#2e7d32;margin-bottom:8px;display:block;"></i>
          <div style="font-weight:700;font-size:1rem;color:#1b5e20;">${nom}</div>
          <div style="font-size:0.82rem;color:#666;margin-top:4px;">Cette tablette deviendra le terminal de pointage de cette agence</div>
        </div>

        <div style="background:#fff3e0;border-radius:8px;padding:10px;font-size:0.82rem;color:#e65100;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <strong>Attention :</strong> L'interface admin se fermera. Pour sortir du kiosque, vous aurez besoin d'un code PIN.
        </div>

        <div>
          <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:6px;">
            <i class="fa-solid fa-lock"></i> Choisir un code PIN de sortie (4 chiffres)
          </label>
          <input id="deploy-pin" type="password" maxlength="4" inputmode="numeric"
            placeholder="Ex: 1234"
            style="width:100%;padding:12px;border:1.5px solid #ddd;border-radius:8px;font-size:1.2rem;text-align:center;letter-spacing:0.3em;box-sizing:border-box;" />
          <div style="font-size:0.75rem;color:#aaa;margin-top:4px;">Ce PIN sera nécessaire pour quitter le mode kiosque</div>
        </div>
      </div>
    `,
    confirmText: 'Deployer maintenant',
    cancelText: 'Annuler',
    onConfirm: async (close) => {
      const pin = document.getElementById('deploy-pin')?.value;
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        showToast('PIN invalide — 4 chiffres requis.', 'warning');
        return;
      }

      // Hash simple du PIN
      const pinHash = btoa(pin + '_smartpointage_' + token.slice(0, 8));

      // Stocker en localStorage
      localStorage.setItem('kiosque_mode', token);
      localStorage.setItem('kiosque_nom', nom);
      localStorage.setItem('kiosque_site', site);
      localStorage.setItem('kiosque_pin', pinHash);

      // Supprimer les credentials admin
      localStorage.removeItem('pamecas_token');
      localStorage.removeItem('pamecas_user');

      showToast('Deploiement en cours...', 'success');
      close();

      // Délai pour que le toast soit visible
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  });
  return;
}
```

---

## MISSION 3 — Sortie du kiosque avec PIN (5x tap logo)

### client/public/src/pages/kiosque.js
Ajouter la logique de sortie secrète dans `renderKiosque`, après le rendu HTML :

```javascript
// Compteur de taps secret sur le logo SP
let tapCount = 0;
let tapTimer = null;

const logoEl = root.querySelector('.kiosque-logo-sp');
if (logoEl) {
  logoEl.addEventListener('click', () => {
    tapCount++;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 2000);

    if (tapCount >= 5) {
      tapCount = 0;
      demanderPINSortie();
    }
  });
}

function demanderPINSortie() {
  showModal({
    title: 'Quitter le mode kiosque',
    content: `
      <div style="text-align:center;">
        <i class="fa-solid fa-lock" style="font-size:2rem;color:#c62828;margin-bottom:12px;display:block;"></i>
        <div style="margin-bottom:16px;color:#555;font-size:0.9rem;">Entrez le code PIN administrateur</div>
        <input id="exit-pin" type="password" maxlength="4" inputmode="numeric"
          placeholder="••••"
          style="width:140px;padding:12px;border:1.5px solid #ddd;border-radius:8px;font-size:1.5rem;text-align:center;letter-spacing:0.4em;" />
      </div>
    `,
    confirmText: 'Confirmer',
    cancelText: 'Annuler',
    onConfirm: (close) => {
      const pin = document.getElementById('exit-pin')?.value;
      const storedHash = localStorage.getItem('kiosque_pin');
      const kiosqueToken = localStorage.getItem('kiosque_mode');

      if (!pin || !storedHash) { showToast('PIN invalide.', 'error'); return; }

      const pinHash = btoa(pin + '_smartpointage_' + kiosqueToken.slice(0, 8));

      if (pinHash !== storedHash) {
        showToast('Code PIN incorrect.', 'error');
        return;
      }

      // PIN correct — sortir du kiosque
      localStorage.removeItem('kiosque_mode');
      localStorage.removeItem('kiosque_nom');
      localStorage.removeItem('kiosque_site');
      localStorage.removeItem('kiosque_pin');
      // Arrêter la caméra
      stopCamera();
      close();
      showToast('Mode kiosque desactive.', 'success');
      setTimeout(() => {
        window.location.hash = '#/login';
        window.location.reload();
      }, 500);
    }
  });
}
```

Ajouter `id="kiosque-logo-sp"` sur le div logo SP dans le HTML du kiosque :
```javascript
// Dans le header du kiosque, modifier :
<div style="..." id="kiosque-logo-sp">SP</div>
// Et ajouter la ref :
const logoEl = root.querySelector('#kiosque-logo-sp');
```

---

## MISSION 4 — Plein écran automatique Android

### client/public/src/pages/kiosque.js
Ajouter après le rendu HTML :

```javascript
// Demander plein écran au premier tap (requis par les navigateurs)
document.addEventListener('click', function requestFS() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  document.removeEventListener('click', requestFS);
}, { once: true });
```

---

## Commit

```bash
git add .
git commit -m "feat: deploiement kiosque tablette + PIN sortie + plein ecran auto"
git push
```

---

## Flow complet résumé

```
1. Admin ouvre SmartPointage sur tablette
2. Se connecte normalement
3. Menu Agences → "Deployer kiosque" sur PAM-DG
4. Choisit PIN 4 chiffres → Confirme
5. App recharge → mode kiosque permanent
6. Plus d'interface admin — seulement le scanner QR
7. Pour sortir : appuie 5x sur logo SP → entre PIN
8. Retour sur page login
```
