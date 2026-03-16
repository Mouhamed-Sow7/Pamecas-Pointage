# SmartPointage — Sprint final démo PAMECAS

## Contexte
Lire chaque fichier concerné avant de modifier. Stack: Node.js + Express + MongoDB + Vanilla JS ES modules.

---

## MISSION 1 — Filtre kiosque : agents par agence uniquement

### server/routes/agents.js
Dans la route GET /search?matricule=, ajouter filtre site_id si token kiosque :

```javascript
router.get('/search', authenticate, async (req, res) => {
  try {
    const { matricule } = req.query;
    if (!matricule) return res.status(400).json({ message: 'Matricule requis.' });

    const filter = { matricule: matricule.toUpperCase(), statut: 'actif' };

    // Si token kiosque — filtrer uniquement les agents de cette agence
    if (req.user.is_kiosque && req.user.site_id) {
      filter.site_id = req.user.site_id;
    }

    const agent = await Agent.findOne(filter).populate('site_id', 'nom code');
    if (!agent) return res.status(404).json({ message: 'Agent introuvable pour cette agence.' });
    return res.json(agent);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur recherche agent.' });
  }
});
```

---

## MISSION 2 — URL kiosque permanente auto à la création d'agence

### server/routes/sites.js
Dans le POST / (création agence), générer automatiquement un kiosque_token UUID :

```javascript
const { v4: uuidv4 } = require('uuid');

// Dans router.post('/', ...) après validation, avant save :
site.kiosque_token = uuidv4();
site.kiosque_token_created_at = new Date();
```

Dans le GET / (liste agences), inclure kiosque_url dans la réponse :
```javascript
// Après avoir récupéré les sites, mapper pour ajouter kiosque_url :
const baseUrl = process.env.APP_URL || 'https://pamecas-pointage.onrender.com';
const sitesAvecUrl = sites.map(s => ({
  ...s.toObject(),
  kiosque_url: s.kiosque_token
    ? `${baseUrl}/#/kiosque?ktoken=${s.kiosque_token}`
    : null
}));
return res.json(sitesAvecUrl);
```

### server/seed.js
Lors de la création des agences dans le seed, générer un kiosque_token pour chaque agence si absent :
```javascript
const { v4: uuidv4 } = require('uuid');
// Dans la boucle upsert des agences :
agence.kiosque_token = agence.kiosque_token || uuidv4();
agence.kiosque_token_created_at = agence.kiosque_token_created_at || new Date();
```

### client/public/src/pages/sites.js
Dans le tableau des agences, ajouter une colonne "Kiosque" avec :
- Icône tablette + bouton "Copier URL" si token existe
- Badge "URL générée" vert
- L'URL complète au survol (title attribute)

```javascript
// Dans renderTable, ajouter colonne kiosque après Actions :
`<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
  ${site.kiosque_url ? `
    <button class="btn-copy-kiosque"
      data-url="${site.kiosque_url}"
      data-nom="${site.nom}"
      style="display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;border:1.5px solid #2e7d32;background:white;color:#2e7d32;cursor:pointer;font-size:0.75rem;font-weight:500;"
      title="${site.kiosque_url}">
      <i class="fa-solid fa-tablet-screen-button"></i> Copier URL
    </button>
  ` : `
    <button class="btn-gen-kiosque" data-id="${site._id}"
      style="padding:5px 10px;border-radius:8px;border:1.5px solid #aaa;background:white;color:#aaa;cursor:pointer;font-size:0.75rem;">
      Générer
    </button>
  `}
</td>`

// Event delegation :
tbody.addEventListener('click', async e => {
  const btnCopy = e.target.closest('.btn-copy-kiosque');
  const btnGen = e.target.closest('.btn-gen-kiosque');

  if (btnCopy) {
    await navigator.clipboard.writeText(btnCopy.dataset.url);
    showToast(`URL kiosque ${btnCopy.dataset.nom} copiée !`, 'success');
    return;
  }

  if (btnGen) {
    try {
      const token = localStorage.getItem('pamecas_token');
      const res = await fetch(`/api/sites/${btnGen.dataset.id}/kiosque-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      showToast('URL kiosque générée !', 'success');
      fetchSites(root);
    } catch { showToast('Erreur génération.', 'error'); }
    return;
  }
});
```

---

## MISSION 3 — Import agents CSV

### server/routes/agents.js
Ajouter route POST /import-csv :

```javascript
const multer = require('multer');
const csv = require('csv-parse/sync');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/import-csv', authenticate, authorizeRoles('superadmin', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Fichier CSV requis.' });

    const content = req.file.buffer.toString('utf-8');
    const records = csv.parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: [',', ';'] // accepte virgule et point-virgule
    });

    const site_id = req.body.site_id || req.user.site_id;
    if (!site_id) return res.status(400).json({ message: 'site_id obligatoire.' });

    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of records) {
      try {
        const nom = row.nom || row.NOM || row.Nom;
        const prenom = row.prenom || row.PRENOM || row.Prenom;
        const type_contrat = (row.type_contrat || row.contrat || 'CDI').toLowerCase();
        const telephone = row.telephone || row.TELEPHONE || row.tel || '';
        const poste = row.poste || row.POSTE || '';

        if (!nom || !prenom) { results.errors.push(`Ligne ignorée: nom/prenom manquant`); continue; }

        const existing = await Agent.findOne({ nom, prenom, site_id });
        if (existing) { results.skipped++; continue; }

        const agent = new Agent({
          nom: nom.trim(),
          prenom: prenom.trim(),
          type_contrat: ['cdi','cdd','stage','prestataire'].includes(type_contrat) ? type_contrat : 'CDI',
          telephone: telephone.trim(),
          poste: poste.trim(),
          site_id,
          statut: 'actif'
        });
        await agent.save();
        results.created++;
      } catch (e) {
        results.errors.push(`Erreur: ${e.message}`);
      }
    }

    return res.json({
      message: `Import terminé: ${results.created} créés, ${results.skipped} ignorés`,
      ...results
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur import CSV: ' + err.message });
  }
});
```

### client/public/src/pages/agents.js
Ajouter bouton "Importer CSV" à côté de "Ajouter agent" :

```javascript
// Dans le header de la page agents, ajouter :
<button id="btn-import-csv" class="btn-primary" style="background:linear-gradient(135deg,#1565c0,#1976d2);">
  <i class="fa-solid fa-file-csv"></i> Importer CSV
</button>

// Modal import CSV :
function openImportModal(sites) {
  const siteOptions = sites.map(s => `<option value="${s._id}">${s.nom}</option>`).join('');
  showModal({
    title: 'Importer agents depuis CSV',
    content: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="background:#e3f2fd;border-radius:8px;padding:12px;font-size:0.82rem;color:#1565c0;">
          <i class="fa-solid fa-circle-info"></i>
          Format CSV attendu (séparateur virgule ou point-virgule) :<br>
          <code style="background:white;padding:2px 6px;border-radius:4px;font-size:0.78rem;">nom;prenom;type_contrat;telephone;poste</code>
        </div>
        <div>
          <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:6px;">Agence</label>
          <select id="import-site-id" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;">
            ${siteOptions}
          </select>
        </div>
        <div>
          <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:6px;">Fichier CSV</label>
          <input id="import-file" type="file" accept=".csv,.txt" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;" />
        </div>
        <div id="import-result" style="display:none;"></div>
      </div>
    `,
    confirmText: 'Importer',
    cancelText: 'Annuler',
    onConfirm: async (close) => {
      const file = document.getElementById('import-file').files[0];
      const siteId = document.getElementById('import-site-id').value;
      if (!file) { showToast('Sélectionnez un fichier CSV.', 'warning'); return; }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('site_id', siteId);

      try {
        const token = localStorage.getItem('pamecas_token');
        const res = await fetch('/api/agents/import-csv', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message, 'success');
          close();
          // recharger la liste agents
        } else {
          showToast(data.message, 'error');
        }
      } catch { showToast('Erreur import.', 'error'); }
    }
  });
}
```

### package.json — ajouter dépendances
```bash
npm install multer csv-parse
```

---

## MISSION 4 — Génération QR cards PDF par agence

### server/routes/agents.js
Ajouter route GET /qr-sheet/:site_id — génère un HTML imprimable avec tous les QR codes :

```javascript
const QRCode = require('qrcode');

router.get('/qr-sheet/:site_id', authenticate, authorizeRoles('superadmin', 'admin'), async (req, res) => {
  try {
    const agents = await Agent.find({
      site_id: req.params.site_id,
      statut: 'actif'
    }).populate('site_id', 'nom code').sort({ nom: 1 });

    if (!agents.length) return res.status(404).json({ message: 'Aucun agent actif dans cette agence.' });

    const site = agents[0].site_id;

    // Générer QR base64 pour chaque agent
    const cartes = await Promise.all(agents.map(async (agent) => {
      const qrDataUrl = await QRCode.toDataURL(agent.matricule, {
        width: 200,
        margin: 1,
        color: { dark: '#1b5e20', light: '#ffffff' }
      });
      return { agent, qrDataUrl };
    }));

    // HTML imprimable
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>QR Codes — ${site.nom}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    h1 { text-align:center; color: #1b5e20; margin-bottom: 6px; font-size: 1.4rem; }
    .subtitle { text-align:center; color: #666; font-size: 0.85rem; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 900px; margin: 0 auto; }
    .card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      border: 1px solid #e8f5e9;
      break-inside: avoid;
    }
    .card-header {
      background: linear-gradient(135deg, #1b5e20, #2e7d32);
      color: white;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    .qr-img { width: 140px; height: 140px; margin: 0 auto 10px; display: block; }
    .agent-nom { font-weight: 700; font-size: 0.9rem; color: #1f2933; margin-bottom: 2px; }
    .agent-matricule { font-size: 0.75rem; color: #2e7d32; font-weight: 600; margin-bottom: 2px; }
    .agent-poste { font-size: 0.72rem; color: #888; }
    .agent-contrat { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 10px; background: #e8f5e9; color: #2e7d32; font-size: 0.68rem; font-weight: 600; }
    @media print {
      body { background: white; padding: 10px; }
      .no-print { display: none; }
      .grid { gap: 10px; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:20px;">
    <button onclick="window.print()"
      style="padding:10px 24px;background:#2e7d32;color:white;border:none;border-radius:8px;font-size:1rem;cursor:pointer;font-weight:600;">
      🖨️ Imprimer / Sauvegarder PDF
    </button>
    <span style="margin-left:16px;color:#888;font-size:0.85rem;">Utilisez Ctrl+P puis "Enregistrer en PDF"</span>
  </div>
  <h1>SmartPointage — Cartes QR Code</h1>
  <div class="subtitle">${site.nom} · ${agents.length} agents · Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
  <div class="grid">
    ${cartes.map(({ agent, qrDataUrl }) => `
    <div class="card">
      <div class="card-header">SMARTPOINTAGE · ${site.code}</div>
      <img class="qr-img" src="${qrDataUrl}" alt="QR ${agent.matricule}">
      <div class="agent-nom">${agent.nom} ${agent.prenom}</div>
      <div class="agent-matricule">${agent.matricule}</div>
      <div class="agent-poste">${agent.poste || ''}</div>
      <span class="agent-contrat">${agent.type_contrat.toUpperCase()}</span>
    </div>`).join('')}
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur génération QR sheet.' });
  }
});
```

### client/public/src/pages/agents.js
Ajouter bouton "QR Cards" dans le header :

```javascript
<button id="btn-qr-sheet" class="btn-primary" style="background:linear-gradient(135deg,#6a1b9a,#8e24aa);">
  <i class="fa-solid fa-id-card"></i> QR Cards
</button>

// Handler :
btnQrSheet.addEventListener('click', () => {
  // Ouvrir dans nouvel onglet — le navigateur affichera la page imprimable
  const token = localStorage.getItem('pamecas_token');
  // Utiliser le site de l'user ou demander lequel
  const user = getCurrentUser();
  const siteId = user?.site_id;
  if (!siteId) {
    showToast('Sélectionnez une agence d\'abord.', 'warning');
    return;
  }
  window.open(`/api/agents/qr-sheet/${siteId}?token=${token}`, '_blank');
});
```

Modifier la route qr-sheet pour accepter token en query param (pour ouverture dans nouvel onglet) :
```javascript
// Dans la route, avant authenticate, accepter token depuis query :
router.get('/qr-sheet/:site_id', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authenticate, authorizeRoles('superadmin', 'admin'), async (req, res) => {
```

---

## MISSION 5 — PWA Android installable

### client/public/manifest.json
Mettre à jour avec icônes PNG réelles et tous les critères Chrome :

```json
{
  "name": "SmartPointage",
  "short_name": "SmartPointage",
  "description": "Systeme de pointage digital pour agences et entreprises au Senegal.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#2E7D32",
  "theme_color": "#2E7D32",
  "lang": "fr",
  "categories": ["business", "productivity"],
  "icons": [
    {
      "src": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='192' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='32' fill='%232E7D32'/%3E%3Ccircle cx='96' cy='96' r='60' fill='%234CAF50'/%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' dominant-baseline='middle' font-family='Inter,sans-serif' font-size='44' font-weight='700' fill='%23FFFFFF'%3ESP%3C/text%3E%3C/svg%3E",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='72' fill='%232E7D32'/%3E%3Ccircle cx='256' cy='256' r='168' fill='%234CAF50'/%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' dominant-baseline='middle' font-family='Inter,sans-serif' font-size='120' font-weight='700' fill='%23FFFFFF'%3ESP%3C/text%3E%3C/svg%3E",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Pointage",
      "url": "/#/pointage",
      "description": "Pointer une arrivee ou un depart"
    },
    {
      "name": "Dashboard",
      "url": "/#/dashboard",
      "description": "Voir les statistiques du jour"
    }
  ]
}
```

### client/public/sw.js
Vérifier que le Service Worker est bien enregistré et que la stratégie cache est correcte.
Mettre à jour la version du cache en 'smartpointage-v3' pour forcer le rechargement.

---

## Installation npm requise

```bash
npm install multer csv-parse
```

## Commit final

```bash
git add .
git commit -m "feat: filtre kiosque par agence + URL permanente + import CSV + QR cards + PWA"
git push
```

---

## Résumé des nouvelles fonctionnalités

| Feature | Accès |
|---------|-------|
| Filtre kiosque agents par agence | Automatique |
| URL kiosque auto à création agence | superadmin |
| Copier URL kiosque depuis Agences | superadmin/admin |
| Import CSV agents | superadmin/admin |
| QR Cards imprimables | superadmin/admin |
| PWA installable Android | Tous |