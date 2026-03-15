# SmartPointage — God Mode + Nettoyage rôles DR/DG

## Contexte
Lire tous les fichiers concernés avant de modifier.
Le "God Mode" est un accès maître pour le vendeur SaaS (Mouhamed) qui gère toutes les instances clients.

---

## MISSION 1 — Variable d'environnement God Mode

### server/middleware/auth.js
Dans la fonction `authenticate`, AVANT toute vérification JWT, ajouter :

```javascript
// God Mode — token maître du vendeur SaaS
if (process.env.GOD_MODE_TOKEN && token === process.env.GOD_MODE_TOKEN) {
  req.user = {
    id: 'god_mode',
    username: 'smartpointage_admin',
    role: 'superadmin',
    site_id: null,
    site_nom: 'God Mode',
    sites_ids: [],
    is_god_mode: true
  };
  return next();
}
```

Ajouter `GOD_MODE_TOKEN` dans les variables Render :
```
GOD_MODE_TOKEN = un_token_tres_long_et_secret_genere_aleatoirement
```

---

## MISSION 2 — Restreindre directeur_regional

### server/routes/users.js
Retirer `directeur_regional` de tous les `authorizeRoles` — le DR ne gère PAS les users :

```javascript
// Changer partout :
authorizeRoles('superadmin', 'directeur_regional')
// Par :
authorizeRoles('superadmin')
```

### client/public/src/pages/users.js
La page users ne doit être accessible qu'au superadmin.
Ajouter en haut de `renderUsers` :
```javascript
if (!user || user.role !== 'superadmin') {
  root.innerHTML = `
    <div style="text-align:center;padding:40px;color:#aaa;">
      <i class="fa-solid fa-lock" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
      <div>Accès réservé au Super Administrateur</div>
    </div>
  `;
  return;
}
```

### client/public/src/components/navbar.js
Retirer `directeur_regional` du lien Utilisateurs :
```javascript
// Changer :
if (user && ['superadmin', 'directeur_regional'].includes(user.role)) {
// Par :
if (user && user.role === 'superadmin') {
```

---

## MISSION 3 — Menu DR simplifié

### client/public/src/components/navbar.js
Le directeur_regional ne voit que Dashboard + Rapports :

```javascript
const links = [
  { path: '#/dashboard', label: 'Dashboard', icon: '<i class="fa-regular fa-house"></i>' },
];

// Pointage : seulement admin/pointeur/superviseur (pas DR)
if (user && ['admin', 'superviseur', 'pointeur'].includes(user.role)) {
  links.push({ path: '#/pointage', label: 'Pointage', icon: '<i class="fa-regular fa-circle-dot"></i>' });
}

// Agents : admin/superviseur seulement
if (user && ['admin', 'superviseur'].includes(user.role)) {
  links.push({ path: '#/agents', label: 'Agents', icon: '<i class="fa-solid fa-users"></i>' });
}

// Rapports : DR + admin + superadmin
if (user && ['superadmin', 'directeur_regional', 'admin'].includes(user.role)) {
  links.push({ path: '#/rapports', label: 'Rapports', icon: '<i class="fa-regular fa-file-alt"></i>' });
}

// Agences : superadmin seulement
if (user && user.role === 'superadmin') {
  links.push({ path: '#/sites', label: 'Agences', icon: '<i class="fa-regular fa-building"></i>' });
}

// Utilisateurs : superadmin seulement
if (user && user.role === 'superadmin') {
  links.push({ path: '#/users', label: 'Utilisateurs', icon: '<i class="fa-solid fa-users-gear"></i>' });
}
```

---

## MISSION 4 — Dashboard DR multi-agences

### client/public/src/pages/dashboard.js
Le DR voit un dashboard avec stats de SES agences uniquement (tenantFilter s'en occupe déjà côté backend).

Ajouter un titre contextuel selon le rôle :
```javascript
// Dans renderDashboard, modifier le titre :
const roleLabel = {
  superadmin: 'Toutes les agences',
  directeur_regional: 'Vos agences',
  admin: user?.site_nom || 'Votre agence',
  pointeur: user?.site_nom || 'Votre agence'
}[user?.role] || '';

// Afficher sous le titre :
`<div style="font-size:0.78rem;color:#aaa;margin-top:2px;">
  <i class="fa-solid fa-building" style="margin-right:4px;"></i>${roleLabel}
</div>`
```

---

## MISSION 5 — Rapports filtrés par tenant

### server/routes/rapports.js
Dans `/dashboard-today` et `/export`, appliquer `tenantFilter` :

Ajouter `tenantFilter` dans le middleware de la route :
```javascript
const { authenticate, tenantFilter } = require('../middleware/auth');
router.use(authenticate);
router.use(tenantFilter);
```

Dans `/dashboard-today`, merger `req.siteFilter` dans le match :
```javascript
const match = { ...req.siteFilter, date: dateStr };
// Supprimer le filtre site_id manuel par query param pour les non-superadmin
if (req.user.role !== 'superadmin' && site_id) {
  // Vérifier que le site demandé est dans son périmètre
  if (req.siteFilter.site_id && req.siteFilter.site_id.toString() !== site_id) {
    return res.status(403).json({ message: 'Accès refusé à ce site.' });
  }
}
```

---

## MISSION 6 — Indicateur God Mode dans navbar

### client/public/src/components/navbar.js
Si `user.is_god_mode` est true (transmis dans le JWT), afficher un badge discret :

Dans le JWT payload (server/routes/auth.js), ajouter `is_god_mode: false` par défaut.

Dans la navbar, sous le username :
```javascript
${req.user?.is_god_mode ? `
<div style="font-size:0.68rem;background:rgba(255,215,0,0.15);color:gold;padding:2px 8px;border-radius:10px;border:1px solid rgba(255,215,0,0.3);margin-top:4px;text-align:center;">
  ⚡ God Mode
</div>` : ''}
```

---

## MISSION 7 — Page rapports DR

### client/public/src/pages/rapports.js
Pour le directeur_regional, ajouter un select "Agence" qui liste uniquement SES agences.
Pour superadmin, lister toutes les agences.
Utiliser GET /api/sites pour charger la liste (le tenantFilter côté backend filtrera automatiquement).

---

## Commit

```bash
git add .
git commit -m "feat: god mode token + roles DR/DG simplifies + menus contextualises par role"
git push
```

---

## Variables Render à ajouter

```
GOD_MODE_TOKEN = smartpointage_god_2026_xK9mN3pQ7rL2wV8
```

Change cette valeur par quelque chose d'unique et secret que toi seul connais.

---

## Résumé accès par rôle

| Feature | God Mode | Superadmin | Dir. Régional | Admin | Pointeur |
|---------|----------|------------|---------------|-------|----------|
| Dashboard | ✅ Tout | ✅ Tout | ✅ Ses agences | ✅ Son agence | ✅ Son agence |
| Pointage | ✅ | ✅ | ❌ | ✅ | ✅ |
| Agents | ✅ | ✅ | ❌ | ✅ | ❌ |
| Rapports | ✅ Tout | ✅ Tout | ✅ Ses agences | ✅ Son agence | ❌ |
| Agences | ✅ | ✅ | ❌ | ❌ | ❌ |
| Utilisateurs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kiosque URL | ✅ | ✅ | ❌ | ❌ | ❌ |
