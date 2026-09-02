# SmartPointage — 3 fixes : Offline QR + Filtres agents + UTF-8

## IMPORTANT : Lire ces fichiers avant de modifier
- client/public/src/pages/kiosque.js
- client/public/src/pages/agents.js
- client/public/src/store/indexedDB.js
- server/routes/agents.js
- Tous les fichiers .js dans client/public/src/ et server/

---

## MISSION 1 — Offline QR : utiliser cache IndexedDB

### Problème
En mode offline, le kiosque appelle `/api/agents/search?matricule=` qui échoue.
Il faut d'abord chercher dans le cache IndexedDB avant d'appeler l'API.

### client/public/src/store/indexedDB.js
Ajouter cette fonction de recherche par matricule dans le cache :

```javascript
export async function getAgentByMatricule(matricule) {
  const db = await openDB();
  const tx = db.transaction(STORE_AGENTS, 'readonly');
  const store = tx.objectStore(STORE_AGENTS);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const agents = request.result || [];
      const found = agents.find(a =>
        (a.matricule || '').toUpperCase() === matricule.toUpperCase()
      );
      resolve(found || null);
    };
    request.onerror = () => reject(request.error);
  });
}
```

### client/public/src/pages/kiosque.js
Modifier la fonction `rechercherAgentParMatricule` (ou équivalent) pour utiliser le cache offline :

```javascript
async function rechercherAgentParMatricule(matricule, token) {
  // Si offline — chercher dans le cache IndexedDB
  if (!navigator.onLine) {
    const { getAgentByMatricule } = await import('../store/indexedDB.js');
    const cached = await getAgentByMatricule(matricule);
    if (cached) return cached;
    throw new Error('Agent introuvable (mode hors ligne)');
  }

  // En ligne — appel API normal
  const response = await fetch(
    `/api/agents/search?matricule=${encodeURIComponent(matricule)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error('Agent introuvable');
  return await response.json();
}
```

### client/public/src/pages/kiosque.js
Modifier aussi `enregistrerPointageKiosque` pour sauvegarder en IndexedDB si offline :

```javascript
async function enregistrerPointageKiosque(token, agentId, siteId, type) {
  const now = new Date();
  const payload = {
    local_id: crypto.randomUUID(),
    agent_id: agentId,
    site_id: siteId,
    date: now.toISOString().split('T')[0],
    heure_arrivee: type === 'arrivee' ? now.toTimeString().slice(0, 5) : undefined,
    heure_depart: type === 'depart' ? now.toTimeString().slice(0, 5) : undefined,
    methode: 'qr_code',
    type,
    sync_status: 'local'
  };

  // Si offline — sauvegarder en IndexedDB
  if (!navigator.onLine) {
    const { savePointage } = await import('../store/indexedDB.js');
    await savePointage(payload);
    return { offline: true };
  }

  // En ligne — appel API
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
```

### client/public/src/pages/kiosque.js
Dans `onQRDetected`, adapter le message de succès pour le mode offline :

```javascript
const result = await enregistrerPointageKiosque(token, agent._id || agent.id, siteId, type);

if (result?.offline) {
  playBeep(type);
  // Afficher confirmation avec badge offline
  setEtat(root, 'succes', { agent, type, offline: true });
} else {
  playBeep(type);
  setEtat(root, 'succes', { agent, type });
}
```

Dans `setEtat` pour 'succes', ajouter indicateur offline si present :

```javascript
${data.offline ? `
  <div style="margin-top:8px;font-size:0.75rem;background:rgba(255,152,0,0.2);color:#ffcc02;padding:4px 10px;border-radius:10px;display:inline-block;">
    <i class="fa-solid fa-wifi-slash"></i> Sauvegarde hors ligne
  </div>` : ''}
```

### Mise en cache des agents au chargement du kiosque
Dans `renderKiosque`, après avoir résolu le site, charger et cacher tous les agents de l'agence :

```javascript
// Après résolution du siteId, charger les agents en cache
async function chargerAgentsEnCache(siteId, token) {
  try {
    const res = await fetch(`/api/agents?site_id=${siteId}&limit=500`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const agents = data.data || [];
      if (agents.length > 0) {
        const { cacheAgents } = await import('../store/indexedDB.js');
        await cacheAgents(agents);
        console.log(`${agents.length} agents mis en cache pour mode offline`);
      }
    }
  } catch (e) {
    console.warn('Cache agents impossible:', e.message);
  }
}

// Appeler au démarrage du kiosque (si en ligne)
if (navigator.onLine && siteId) {
  chargerAgentsEnCache(siteId, token);
}
```

---

## MISSION 2 — Filtres agents améliorés avec agence

### client/public/src/pages/agents.js
Remplacer la barre de filtres existante par cette version améliorée :

```javascript
// Header avec filtres
root.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:12px;">

    <!-- Titre + boutons -->
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h2 style="font-size:1.1rem;font-weight:700;">
        <i class="fa-solid fa-users" style="color:#2e7d32;margin-right:6px;"></i>Agents
      </h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="btn-import-csv" class="btn-primary" style="background:linear-gradient(135deg,#1565c0,#1976d2);font-size:0.82rem;padding:8px 12px;">
          <i class="fa-solid fa-file-csv"></i> Importer CSV
        </button>
        <button id="btn-qr-sheet" class="btn-primary" style="background:linear-gradient(135deg,#6a1b9a,#8e24aa);font-size:0.82rem;padding:8px 12px;">
          <i class="fa-solid fa-id-card"></i> QR Cards
        </button>
        <button id="btn-add-agent" class="btn-primary" style="font-size:0.82rem;padding:8px 12px;">
          <i class="fa-solid fa-plus"></i> Ajouter
        </button>
      </div>
    </div>

    <!-- Filtres -->
    <div style="background:white;border-radius:10px;padding:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);border:1px solid #eee;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;">

        <!-- Recherche texte -->
        <div>
          <label style="font-size:0.75rem;font-weight:600;color:#666;display:block;margin-bottom:4px;">
            <i class="fa-solid fa-magnifying-glass" style="color:#2e7d32;"></i> Recherche
          </label>
          <input id="filter-search" placeholder="Nom, prénom ou matricule..."
            style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;box-sizing:border-box;" />
        </div>

        <!-- Filtre agence (superadmin seulement) -->
        <div id="filter-agence-wrap">
          <label style="font-size:0.75rem;font-weight:600;color:#666;display:block;margin-bottom:4px;">
            <i class="fa-solid fa-building" style="color:#2e7d32;"></i> Agence
          </label>
          <select id="filter-agence"
            style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
            <option value="">Toutes les agences</option>
          </select>
        </div>

        <!-- Filtre type contrat -->
        <div>
          <label style="font-size:0.75rem;font-weight:600;color:#666;display:block;margin-bottom:4px;">
            <i class="fa-solid fa-file-contract" style="color:#2e7d32;"></i> Type contrat
          </label>
          <select id="filter-type"
            style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
            <option value="">Tous types</option>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="stage">Stage</option>
            <option value="prestataire">Prestataire</option>
          </select>
        </div>

        <!-- Filtre statut -->
        <div>
          <label style="font-size:0.75rem;font-weight:600;color:#666;display:block;margin-bottom:4px;">
            <i class="fa-solid fa-circle-half-stroke" style="color:#2e7d32;"></i> Statut
          </label>
          <select id="filter-statut"
            style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
            <option value="actif">Actifs</option>
            <option value="">Tous</option>
            <option value="inactif">Inactifs</option>
          </select>
        </div>

      </div>

      <!-- Bouton filtrer + compteur résultats -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
        <span id="agents-count" style="font-size:0.8rem;color:#888;">Chargement...</span>
        <button id="btn-filter" class="btn-primary" style="padding:8px 16px;font-size:0.82rem;">
          <i class="fa-solid fa-filter"></i> Filtrer
        </button>
      </div>
    </div>

    <!-- Liste agents scrollable -->
    <div id="agents-list" style="max-height:calc(100vh - 320px);overflow-y:auto;display:flex;flex-direction:column;gap:6px;scrollbar-width:thin;scrollbar-color:#c8e6c9 #f5f5f5;">
      <div style="text-align:center;padding:20px;color:#999;">
        <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
      </div>
    </div>
  </div>
`;

// Charger agences dans le select (superadmin seulement)
const user = getCurrentUser();
const filterAgenceWrap = root.querySelector('#filter-agence-wrap');
const filterAgence = root.querySelector('#filter-agence');

if (user?.role === 'superadmin') {
  try {
    const res = await get('/api/sites');
    const sites = res.data || res || [];
    sites.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s._id;
      opt.textContent = s.nom;
      filterAgence.appendChild(opt);
    });
  } catch {}
} else {
  // Admin/pointeur — masquer le filtre agence
  if (filterAgenceWrap) filterAgenceWrap.style.display = 'none';
}

// Fonction de chargement avec filtres
async function loadAgents() {
  const search = root.querySelector('#filter-search')?.value?.trim() || '';
  const agenceId = root.querySelector('#filter-agence')?.value || '';
  const type = root.querySelector('#filter-type')?.value || '';
  const statut = root.querySelector('#filter-statut')?.value || 'actif';

  let url = '/api/agents?limit=100';
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (agenceId) url += `&site_id=${agenceId}`;
  if (type) url += `&type_contrat=${type}`;
  if (statut) url += `&statut=${statut}`;

  const agentsList = root.querySelector('#agents-list');
  const agentsCount = root.querySelector('#agents-count');

  agentsList.innerHTML = `<div style="text-align:center;padding:20px;color:#999;"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

  try {
    const res = await get(url);
    const agents = res.data || [];

    if (agentsCount) agentsCount.textContent = `${agents.length} agent(s) trouvé(s)`;

    if (!agents.length) {
      agentsList.innerHTML = `
        <div style="text-align:center;padding:32px;color:#bbb;">
          <i class="fa-solid fa-user-slash" style="font-size:2rem;margin-bottom:8px;display:block;"></i>
          Aucun agent trouvé
        </div>
      `;
      return;
    }

    // Trier alphabétiquement
    agents.sort((a, b) => `${a.nom}${a.prenom}`.localeCompare(`${b.nom}${b.prenom}`));

    agentsList.innerHTML = agents.map(agent => renderAgentCard(agent, user)).join('');

    // Event delegation sur les boutons de chaque carte
    agentsList.querySelectorAll('[data-agent-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAgentAction(btn.dataset.agentAction, btn.dataset.agentId, agents, root));
    });

  } catch (err) {
    agentsList.innerHTML = `<div style="text-align:center;padding:20px;color:#c62828;">Erreur chargement agents</div>`;
  }
}

// Carte agent
function renderAgentCard(agent, user) {
  const contratColors = {
    CDI: { bg: '#e8f5e9', color: '#2e7d32' },
    CDD: { bg: '#e3f2fd', color: '#1565c0' },
    stage: { bg: '#fff3e0', color: '#e65100' },
    prestataire: { bg: '#f3e5f5', color: '#6a1b9a' }
  };
  const cc = contratColors[agent.type_contrat] || { bg: '#f5f5f5', color: '#666' };
  const canEdit = user?.role === 'superadmin' || user?.role === 'admin';

  return `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:white;border:1px solid #eee;border-left:3px solid ${cc.color};border-radius:10px;">
      <!-- Avatar -->
      <div style="width:40px;height:40px;border-radius:50%;background:${cc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;color:${cc.color};font-size:0.9rem;">
        ${agent.nom.charAt(0)}${agent.prenom.charAt(0)}
      </div>

      <!-- Infos -->
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${agent.nom} ${agent.prenom}
        </div>
        <div style="font-size:0.75rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${agent.matricule || ''} · ${agent.site_id?.nom || agent.poste || ''}
        </div>
        <div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap;">
          <span style="font-size:0.68rem;padding:2px 7px;border-radius:10px;background:${cc.bg};color:${cc.color};font-weight:600;">
            ${agent.type_contrat}
          </span>
          <span style="font-size:0.68rem;padding:2px 7px;border-radius:10px;background:${agent.statut === 'actif' ? '#e8f5e9' : '#f5f5f5'};color:${agent.statut === 'actif' ? '#2e7d32' : '#999'};font-weight:500;">
            ${agent.statut}
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;">
        <button data-agent-action="view" data-agent-id="${agent._id}"
          style="width:30px;height:30px;border-radius:7px;border:1.5px solid #2e7d32;background:white;color:#2e7d32;cursor:pointer;font-size:0.72rem;display:flex;align-items:center;justify-content:center;"
          title="Voir QR">
          <i class="fa-solid fa-qrcode"></i>
        </button>
        ${canEdit ? `
        <button data-agent-action="edit" data-agent-id="${agent._id}"
          style="width:30px;height:30px;border-radius:7px;border:1.5px solid #1565c0;background:white;color:#1565c0;cursor:pointer;font-size:0.72rem;display:flex;align-items:center;justify-content:center;"
          title="Modifier">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button data-agent-action="delete" data-agent-id="${agent._id}"
          style="width:30px;height:30px;border-radius:7px;border:1.5px solid #c62828;background:white;color:#c62828;cursor:pointer;font-size:0.72rem;display:flex;align-items:center;justify-content:center;"
          title="Supprimer">
          <i class="fa-solid fa-trash"></i>
        </button>` : ''}
      </div>
    </div>
  `;
}

// Filtrage en temps réel sur la recherche
root.querySelector('#filter-search')?.addEventListener('input', () => loadAgents());
root.querySelector('#filter-agence')?.addEventListener('change', () => loadAgents());
root.querySelector('#filter-type')?.addEventListener('change', () => loadAgents());
root.querySelector('#filter-statut')?.addEventListener('change', () => loadAgents());
root.querySelector('#btn-filter')?.addEventListener('click', () => loadAgents());

// Charger au démarrage
loadAgents();
```

### server/routes/agents.js
S'assurer que la route GET / accepte le paramètre `site_id` en filtre :

```javascript
router.get('/', authenticate, tenantFilter, async (req, res) => {
  try {
    const { search, site_id, type_contrat, statut, limit = 100 } = req.query;

    const filter = { ...req.siteFilter };

    // Filtre site_id explicite (superadmin peut choisir)
    if (site_id && mongoose.Types.ObjectId.isValid(site_id)) {
      filter.site_id = site_id;
    }

    if (type_contrat) filter.type_contrat = type_contrat;
    if (statut) filter.statut = statut;
    else filter.statut = 'actif'; // par défaut actifs seulement

    if (search) {
      filter.$or = [
        { nom: { $regex: search, $options: 'i' } },
        { prenom: { $regex: search, $options: 'i' } },
        { matricule: { $regex: search, $options: 'i' } }
      ];
    }

    const agents = await Agent.find(filter)
      .populate('site_id', 'nom code')
      .sort({ nom: 1, prenom: 1 })
      .limit(parseInt(limit));

    return res.json({ data: agents });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur chargement agents.' });
  }
});
```

---

## MISSION 3 — Correction caractères UTF-8 corrompus

### Règles de remplacement UTF-8
Appliquer ces remplacements dans TOUS les fichiers .js du projet (client et server) :

```
Ã© → é
Ã¨ → è
Ã  → à
Ã® → î
Ã´ → ô
Ã» → û
Ã§ → ç
Ã‰ → É
Ã€ → À
â€™ → '
â€" → —
â€œ → "
â€ → "
Ã¢ → â
Ã» → û
Ã¯ → ï
Ã¼ → ü
Ã± → ñ
â‚¬ → €
Â  →   (espace insécable → espace normal)
Â» → »
Â« → «
```

### Fichiers à corriger en priorité
Chercher et remplacer dans tous ces fichiers :
- server/routes/*.js
- server/models/*.js
- server/seed.js
- server/services/emailReports.js
- client/public/src/pages/*.js
- client/public/src/components/*.js
- client/public/index.html

### Méthode
Pour chaque fichier, lire le contenu, appliquer tous les remplacements ci-dessus, réécrire avec encodage UTF-8.

En Node.js :
```javascript
const fs = require('fs');
const path = require('path');

const replacements = [
  ['Ã©', 'é'], ['Ã¨', 'è'], ['Ã ', 'à'], ['Ã®', 'î'],
  ['Ã´', 'ô'], ['Ã»', 'û'], ['Ã§', 'ç'], ['Ã‰', 'É'],
  ['Ã€', 'À'], ['â€™', "'"], ['â€"', '—'], ['â€œ', '"'],
  ['â€', '"'], ['Ã¢', 'â'], ['Ã¯', 'ï'], ['Ã¼', 'ü'],
  ['â‚¬', '€'], ['Â ', ' '], ['Â»', '»'], ['Â«', '«'],
  ['Ã©e', 'ée'], ['dÃ©', 'dé'], ['prÃ©', 'pré'],
  ['crÃ©', 'cré'], ['gÃ©', 'gé'], ['nÃ©', 'né']
];

function fixEncoding(content) {
  let result = content;
  for (const [bad, good] of replacements) {
    result = result.split(bad).join(good);
  }
  return result;
}

// Appliquer récursivement sur tous les .js et .html
function processDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.includes('.git')) {
      processDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const fixed = fixEncoding(content);
      if (fixed !== content) {
        fs.writeFileSync(fullPath, fixed, 'utf-8');
        console.log('Fixed:', fullPath);
      }
    }
  }
}

processDir('./server');
processDir('./client/public/src');
processDir('./client/public');
```

Sauvegarder ce script en `scripts/fix-encoding.js` et l'exécuter :
```bash
node scripts/fix-encoding.js
```

---

## Commit

```bash
git add .
git commit -m "fix: offline QR cache + filtres agents ameliores + correction UTF-8"
git push
```

---

## Résumé

| Fix | Détail |
|-----|--------|
| Offline QR | Cache agents au démarrage kiosque, recherche IndexedDB si hors ligne |
| Offline pointage | savePointage() si !navigator.onLine dans kiosque |
| Filtres agents | Recherche + agence + type + statut en temps réel |
| Cartes agents | Design pro avec initiales avatar coloré |
| UTF-8 | Script node fix-encoding.js sur tout le projet |
