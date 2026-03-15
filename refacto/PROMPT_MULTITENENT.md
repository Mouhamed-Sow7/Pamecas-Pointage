# SmartPointage — Multi-tenant complet + Token kiosque + UI Gestion users

## Contexte
Stack: Node.js + Express + MongoDB + Vanilla JS ES modules. Pas de bundler.
Projet dans le répertoire courant. Lire les fichiers existants avant de modifier.

---

## MISSION 1 — Nouveau rôle directeur_regional dans User.js

### server/models/User.js
Modifier le champ `role` enum pour ajouter `directeur_regional` :
```javascript
role: {
  type: String,
  enum: ['superadmin', 'directeur_regional', 'admin', 'superviseur', 'pointeur'],
  required: true
}
```

Ajouter le champ `sites_ids` pour directeur_regional (plusieurs agences) :
```javascript
sites_ids: [{
  type: Schema.Types.ObjectId,
  ref: 'Site',
  default: []
}]
```

Garder `site_id` existant pour admin/pointeur (1 seule agence).

---

## MISSION 2 — Token kiosque permanent dans Site.js

### server/models/Site.js
Ajouter ces champs :
```javascript
kiosque_token: {
  type: String,
  default: null,
  index: true
},
kiosque_token_created_at: {
  type: Date,
  default: null
}
```

---

## MISSION 3 — Middleware auth mis à jour

### server/middleware/auth.js
Mettre à jour `tenantFilter` pour supporter `directeur_regional` :
```javascript
function tenantFilter(req, res, next) {
  if (!req.user) return next();

  if (req.user.role === 'superadmin') {
    req.siteFilter = {};
  } else if (req.user.role === 'directeur_regional') {
    // Voit toutes ses agences
    req.siteFilter = { site_id: { $in: req.user.sites_ids || [] } };
  } else if (req.user.site_id) {
    req.siteFilter = { site_id: req.user.site_id };
  } else {
    req.siteFilter = { site_id: null };
  }
  return next();
}
```

Mettre à jour `authenticate` pour charger `sites_ids` :
```javascript
req.user = {
  id: user._id.toString(),
  username: user.username,
  role: user.role,
  site_id: user.site_id?._id?.toString() || user.site_id?.toString() || null,
  site_nom: user.site_id?.nom || null,
  sites_ids: (user.sites_ids || []).map(s => s._id?.toString() || s.toString())
};
```

---

## MISSION 4 — Routes kiosque token dans sites.js backend

### server/routes/sites.js
Ajouter ces deux routes (après les routes existantes, avant module.exports) :

```javascript
const { v4: uuidv4 } = require('uuid');

// Générer token kiosque permanent pour une agence
router.post('/:id/kiosque-token', authenticate, authorizeRoles('superadmin', 'directeur_regional', 'admin'), async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ message: 'Site non trouvé.' });

    // Vérifier accès multi-tenant
    if (req.user.role !== 'superadmin') {
      const siteIdStr = site._id.toString();
      const aAcces =
        (req.user.role === 'directeur_regional' && req.user.sites_ids.includes(siteIdStr)) ||
        (req.user.site_id === siteIdStr);
      if (!aAcces) return res.status(403).json({ message: 'Accès refusé.' });
    }

    site.kiosque_token = uuidv4();
    site.kiosque_token_created_at = new Date();
    await site.save();

    return res.json({
      token: site.kiosque_token,
      created_at: site.kiosque_token_created_at,
      site: { _id: site._id, nom: site.nom, code: site.code }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur génération token.' });
  }
});

// Révoquer token kiosque
router.delete('/:id/kiosque-token', authenticate, authorizeRoles('superadmin', 'admin'), async (req, res) => {
  try {
    await Site.findByIdAndUpdate(req.params.id, { kiosque_token: null, kiosque_token_created_at: null });
    return res.json({ message: 'Token kiosque révoqué.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur révocation.' });
  }
});
```

---

## MISSION 5 — Route auth kiosque (valider token kiosque)

### server/routes/auth.js
Ajouter une route pour valider un token kiosque et retourner les infos du site :

```javascript
// Valider token kiosque (pas besoin de JWT)
router.get('/kiosque/:token', async (req, res) => {
  try {
    const site = await Site.findOne({ kiosque_token: req.params.token, actif: true }).select('_id nom code');
    if (!site) return res.status(401).json({ message: 'Token kiosque invalide.' });
    return res.json({ site });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur validation token.' });
  }
});
```

---

## MISSION 6 — Routes users CRUD pour superadmin

### server/routes/users.js (NOUVEAU FICHIER)
Créer ce fichier :

```javascript
const express = require('express');
const User = require('../models/User');
const Site = require('../models/Site');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET / — Liste tous les users (superadmin) ou users de ses agences (directeur)
router.get('/', authorizeRoles('superadmin', 'directeur_regional'), async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'directeur_regional') {
      filter = { site_id: { $in: req.user.sites_ids } };
    }
    const users = await User.find(filter).populate('site_id', 'nom code').select('-password');
    return res.json({ data: users });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur.' });
  }
});

// POST / — Créer un user
router.post('/', authorizeRoles('superadmin', 'directeur_regional'), async (req, res) => {
  try {
    const { username, password, role, nom_complet, site_id, sites_ids } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ message: 'username, password et role obligatoires.' });
    }

    // Directeur régional ne peut créer que admin/pointeur pour ses agences
    if (req.user.role === 'directeur_regional') {
      if (!['admin', 'pointeur'].includes(role)) {
        return res.status(403).json({ message: 'Vous pouvez créer uniquement admin ou pointeur.' });
      }
      if (site_id && !req.user.sites_ids.includes(site_id)) {
        return res.status(403).json({ message: 'Agence hors de votre périmètre.' });
      }
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'Nom d\'utilisateur déjà pris.' });

    const user = new User({
      username: username.toLowerCase(),
      password,
      role,
      nom_complet,
      site_id: site_id || null,
      sites_ids: sites_ids || [],
      actif: true
    });
    await user.save();

    return res.status(201).json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur création.' });
  }
});

// PUT /:id — Modifier un user
router.put('/:id', authorizeRoles('superadmin', 'directeur_regional'), async (req, res) => {
  try {
    const { nom_complet, role, site_id, sites_ids, actif, password } = req.body;
    const updates = {};
    if (nom_complet) updates.nom_complet = nom_complet;
    if (role) updates.role = role;
    if (site_id !== undefined) updates.site_id = site_id;
    if (sites_ids) updates.sites_ids = sites_ids;
    if (actif !== undefined) updates.actif = actif;

    if (password) {
      // Laisser le pre-save hook hasher
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User non trouvé.' });
      user.password = password;
      Object.assign(user, updates);
      await user.save();
      return res.json(user);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User non trouvé.' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur modification.' });
  }
});

// DELETE /:id — Désactiver un user (pas supprimer)
router.delete('/:id', authorizeRoles('superadmin'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { actif: false });
    return res.json({ message: 'User désactivé.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur.' });
  }
});

module.exports = router;
```

### server/app.js
Ajouter la route users :
```javascript
const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter);
```

---

## MISSION 7 — Page UI Gestion Users (frontend)

### client/public/src/pages/users.js (NOUVEAU FICHIER)
Créer une page de gestion des utilisateurs avec :

**Structure HTML :**
- Header avec titre "Gestion des utilisateurs" + bouton "Ajouter"
- Liste scrollable interne (max-height 500px) des users avec :
  - Nom complet + username
  - Badge rôle coloré (superadmin=rouge, directeur_regional=violet, admin=bleu, pointeur=vert)
  - Agence assignée
  - Statut actif/inactif toggle
  - Bouton modifier + bouton désactiver
- Modal ajout/modification avec :
  - Champs : username, password, nom_complet, rôle (select), agence (select dynamique depuis /api/sites)
  - Pour directeur_regional : multi-select agences (checkboxes)
  - Section "URL Kiosque" avec bouton "Générer token" et affichage de l'URL complète à copier

**Logique :**
- GET /api/users → charger liste
- POST /api/users → créer
- PUT /api/users/:id → modifier
- DELETE /api/users/:id → désactiver
- POST /api/sites/:id/kiosque-token → générer token kiosque
- L'URL kiosque générée = `${window.location.origin}/#/kiosque?token=TOKEN&site=SITE_ID&nom=NOM_ENCODE`

**Badges rôles :**
```javascript
const roleConfig = {
  superadmin:          { label: 'Super Admin',      color: '#c62828', bg: '#ffebee' },
  directeur_regional:  { label: 'Dir. Régional',    color: '#6a1b9a', bg: '#f3e5f5' },
  admin:               { label: 'Admin',             color: '#1565c0', bg: '#e3f2fd' },
  superviseur:         { label: 'Superviseur',       color: '#e65100', bg: '#fff3e0' },
  pointeur:            { label: 'Pointeur',          color: '#2e7d32', bg: '#e8f5e9' },
};
```

**Section kiosque dans modal agence :**
Après les champs du formulaire, si rôle = admin ou directeur_regional, afficher :
```
── Kiosque tablette ──────────────────────
[Agence : PAM-DG]  [Générer URL Kiosque]
URL: https://.../#/kiosque?token=xxx&site=yyy&nom=zzz
[Copier l'URL]
```

---

## MISSION 8 — Navbar mise à jour

### client/public/src/components/navbar.js
Ajouter le lien "Utilisateurs" dans le menu pour superadmin et directeur_regional :

```javascript
if (user && ['superadmin', 'directeur_regional'].includes(user.role)) {
  links.push({ path: '#/users', label: 'Utilisateurs', icon: '<i class="fa-solid fa-users-gear"></i>' });
}
```

### client/public/src/app.js
Ajouter import et route :
```javascript
import { renderUsers } from './pages/users.js';

// Dans mountLayout, ajouter :
} else if (route === '/users') {
  if (topbarTitle) topbarTitle.textContent = 'Utilisateurs';
  renderUsers(main, user);
}
```

---

## MISSION 9 — Kiosque frontend mis à jour

### client/public/src/pages/kiosque.js
Modifier `renderKiosque` pour supporter les deux modes :

**Mode A — Token JWT (ancien, rétro-compatible) :**
URL : `#/kiosque?token=JWT_TOKEN&site=SITE_ID&nom=NOM`

**Mode B — Token kiosque permanent (nouveau) :**
URL : `#/kiosque?ktoken=KIOSQUE_TOKEN`
- Au chargement, appeler `GET /api/auth/kiosque/:token` pour récupérer site_id et nom
- Utiliser ce token dans les headers Authorization : `Bearer KIOSQUE_TOKEN`
- Côté backend, modifier authenticate pour accepter aussi les tokens kiosque (vérifier dans Site collection)

Ajouter dans `server/middleware/auth.js` la détection token kiosque :
```javascript
// Dans authenticate, avant jwt.verify :
// Vérifier si c'est un token kiosque (UUID format)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (uuidRegex.test(token)) {
  const site = await Site.findOne({ kiosque_token: token, actif: true });
  if (!site) return res.status(401).json({ message: 'Token kiosque invalide.' });
  req.user = {
    id: `kiosque_${site._id}`,
    username: `kiosque_${site.code}`,
    role: 'pointeur',
    site_id: site._id.toString(),
    site_nom: site.nom,
    sites_ids: [],
    is_kiosque: true
  };
  return next();
}
```

---

## MISSION 10 — Seed mis à jour

### server/seed.js
Ajouter un directeur régional de démo :
```javascript
{
  username: 'directeur.dakar',
  password: 'pamecas2024!',
  role: 'directeur_regional',
  nom_complet: 'Directeur Régional Dakar',
  sites_ids: [] // sera rempli avec les IDs des agences Dakar après création
}
```
Après création des sites, récupérer les IDs de PAM-DG, PAM-BENE, PAM-CAST et les assigner à directeur.dakar.

---

## Commit final

```bash
git add .
git commit -m "feat: multi-tenant complet — directeur_regional, token kiosque permanent, UI gestion users"
git push
```

---

## Comptes de démo après seed

```
admin              / pamecas2024!  → superadmin (voit tout)
directeur.dakar    / pamecas2024!  → directeur régional (PAM-DG, PAM-BENE, PAM-CAST)
admin.dg           / pamecas2024!  → admin Direction Générale
point.dg           / point2024!    → pointeur Direction Générale
```

## URL kiosque permanente (après génération token)
```
https://pamecas-pointage.onrender.com/#/kiosque?ktoken=UUID_GENERE
```
