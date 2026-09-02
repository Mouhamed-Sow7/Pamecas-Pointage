# SmartPointage — Fix token kiosque invalide + détection auto

## Lire avant de modifier
- server/seed.js
- client/public/src/pages/kiosque.js
- client/public/src/app.js

---

## MISSION 1 — Seed ne regenère plus le kiosque_token existant

### server/seed.js
Dans la boucle de création des agences, NE PAS écraser le kiosque_token s'il existe déjà.

Modifier la logique upsert pour préserver le token existant :

```javascript
for (const agence of agences) {
  // Vérifier si l'agence existe déjà avec un token
  const existing = await Site.findOne({ code: agence.code });
  
  const updateData = { ...agence, actif: true };
  
  // Préserver le kiosque_token existant — ne pas l'écraser
  if (existing?.kiosque_token) {
    delete updateData.kiosque_token;
    delete updateData.kiosque_token_created_at;
  } else {
    // Générer un token seulement si absent
    updateData.kiosque_token = uuidv4();
    updateData.kiosque_token_created_at = new Date();
  }
  
  const site = await Site.findOneAndUpdate(
    { code: agence.code },
    updateData,
    { upsert: true, new: true }
  );
  sitesMap[agence.code] = site;
}
```

---

## MISSION 2 — Détection token invalide + sortie automatique

### client/public/src/app.js
Dans la fonction router(), modifier la détection du mode kiosque pour vérifier la validité du token avant de basculer :

```javascript
// Mode kiosque permanent
const kiosqueToken = localStorage.getItem('kiosque_mode');
if (kiosqueToken) {
  // Vérifier la validité du token avant de basculer
  try {
    const res = await fetch(`/api/auth/kiosque/${kiosqueToken}`);
    if (!res.ok) {
      // Token invalide — nettoyer et rediriger vers login
      console.warn('Token kiosque invalide — nettoyage automatique');
      localStorage.removeItem('kiosque_mode');
      localStorage.removeItem('kiosque_nom');
      localStorage.removeItem('kiosque_site');
      localStorage.removeItem('kiosque_pin');
      window.location.hash = '#/login';
      // Afficher message explicatif
      setTimeout(() => {
        const app = document.getElementById('app');
        if (app) {
          const banner = document.createElement('div');
          banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#e65100;color:white;text-align:center;padding:10px;font-size:0.85rem;z-index:9999;';
          banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Session kiosque expiree — reconnectez-vous pour redeployer.';
          document.body.appendChild(banner);
          setTimeout(() => banner.remove(), 5000);
        }
      }, 100);
      return;
    }
    // Token valide — continuer en mode kiosque
    const data = await res.json();
    window._kiosqueToken = kiosqueToken;
    window._kiosqueSiteNom = data.site?.nom || localStorage.getItem('kiosque_nom') || 'Agence';
  } catch (err) {
    // Erreur réseau — si hors ligne, continuer quand même en mode kiosque
    if (!navigator.onLine) {
      window._kiosqueToken = kiosqueToken;
      window._kiosqueSiteNom = localStorage.getItem('kiosque_nom') || 'Agence';
    } else {
      // En ligne mais erreur — nettoyer
      localStorage.removeItem('kiosque_mode');
      localStorage.removeItem('kiosque_nom');
      localStorage.removeItem('kiosque_site');
      localStorage.removeItem('kiosque_pin');
      window.location.hash = '#/login';
      return;
    }
  }

  const app = document.getElementById('app');
  if (!app) return;
  if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  app.className = '';
  app.innerHTML = '';
  renderKiosque(app);
  return;
}
```

Note importante : router() doit devenir async pour supporter await :
```javascript
async function router() {
  // ... tout le contenu
}
```

---

## MISSION 3 — Bouton "Retour admin" discret dans kiosque si token invalide

### client/public/src/pages/kiosque.js
Dans le cas où le token est invalide (404 depuis /api/auth/kiosque/:token), afficher un bouton de retour au lieu de rester bloqué :

```javascript
// Dans renderKiosque, après la résolution du token :
if (!token) {
  root.innerHTML = `
    <div style="min-height:100vh;background:#0a1a0f;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:20px;text-align:center;">
      <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem;color:#e65100;"></i>
      <div style="color:white;font-size:1.1rem;font-weight:600;">Session kiosque expiree</div>
      <div style="color:rgba(255,255,255,0.6);font-size:0.85rem;">Le token de cette tablette n'est plus valide.</div>
      <button onclick="
        localStorage.removeItem('kiosque_mode');
        localStorage.removeItem('kiosque_nom');
        localStorage.removeItem('kiosque_site');
        localStorage.removeItem('kiosque_pin');
        window.location.hash='#/login';
        window.location.reload();
      " style="padding:12px 24px;background:#2e7d32;color:white;border:none;border-radius:10px;font-size:0.95rem;font-weight:600;cursor:pointer;margin-top:8px;">
        <i class="fa-solid fa-right-to-bracket"></i> Reconnexion admin
      </button>
    </div>
  `;
  return;
}
```

Aussi modifier la gestion d'erreur de résolution du ktoken pour afficher ce message au lieu de rester bloqué :

```javascript
// Si ktoken invalide (res.ok === false)
if (ktokenParam && !siteId) {
  // Afficher page d'erreur avec bouton retour
  // (utiliser le HTML ci-dessus)
  return;
}
```

---

## Commit

```bash
git add .
git commit -m "fix: token kiosque preserve au seed + detection invalide + sortie auto"
git push
```

---

## Résumé des fixes

| Problème | Cause | Fix |
|----------|-------|-----|
| Token invalide après redéploiement | seed.js écrasait le token à chaque restart | Seed préserve le token existant |
| Bloqué sur "token invalide" | Pas de gestion d'erreur dans app.js | Vérification async + nettoyage auto |
| Pas de sortie possible | Pas de bouton retour | Page d'erreur avec bouton "Reconnexion admin" |
| Offline + token non vérifié | fetch échoue hors ligne | Si offline → continuer sans vérifier |
