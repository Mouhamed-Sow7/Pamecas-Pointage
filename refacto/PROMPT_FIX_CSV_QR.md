# Fix: Import CSV + QR Cards pour superadmin

## Lire ces fichiers avant de modifier :
- client/public/src/pages/agents.js
- server/routes/agents.js

---

## MISSION 1 — Fix Import CSV (0 importé)

### Problème
Le modal import envoie le formulaire mais site_id n'est pas transmis correctement.
csv-parse/sync peut aussi avoir un problème avec le séparateur point-virgule.

### server/routes/agents.js — route POST /import-csv
Remplacer la logique de parsing par :

```javascript
router.post('/import-csv', authenticate, authorizeRoles('superadmin', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Fichier CSV requis.' });

    const site_id = req.body.site_id || req.user.site_id;
    if (!site_id) return res.status(400).json({ message: 'site_id obligatoire.' });

    // Parser le CSV manuellement pour eviter les problemes de module
    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV vide ou sans donnees.' });
    }

    // Detecter separateur
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

    console.log('Headers CSV detectes:', headers);
    console.log('Separateur:', sep);
    console.log('Nombre de lignes:', lines.length - 1);

    const results = { created: 0, skipped: 0, errors: [] };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(sep).map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      try {
        const nom = row.nom || '';
        const prenom = row.prenom || '';
        const type_contrat_raw = (row.type_contrat || row.contrat || 'cdi').toLowerCase().trim();
        const telephone = row.telephone || row.tel || '';
        const poste = row.poste || '';

        if (!nom || !prenom) {
          results.errors.push(`Ligne ${i}: nom ou prenom manquant`);
          continue;
        }

        const type_contrat = ['cdi','cdd','stage','prestataire'].includes(type_contrat_raw)
          ? type_contrat_raw : 'CDI';

        const existing = await Agent.findOne({
          nom: nom.trim(),
          prenom: prenom.trim(),
          site_id
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        const agent = new Agent({
          nom: nom.trim(),
          prenom: prenom.trim(),
          type_contrat,
          telephone: telephone.trim(),
          poste: poste.trim(),
          site_id,
          statut: 'actif'
        });

        await agent.save();
        results.created++;
        console.log(`Agent cree: ${nom} ${prenom}`);

      } catch (e) {
        console.error(`Erreur ligne ${i}:`, e.message);
        results.errors.push(`Ligne ${i}: ${e.message}`);
      }
    }

    return res.json({
      message: `Import termine: ${results.created} cree(s), ${results.skipped} ignore(s)`,
      created: results.created,
      skipped: results.skipped,
      errors: results.errors
    });

  } catch (err) {
    console.error('Erreur import CSV:', err);
    return res.status(500).json({ message: 'Erreur import: ' + err.message });
  }
});
```

### client/public/src/pages/agents.js — modal import
Verifier que le site_id est bien transmis. Modifier la fonction openImportModal :

```javascript
async function openImportModal(root) {
  // Charger la liste des sites
  let sites = [];
  try {
    const res = await get('/api/sites');
    sites = res.data || res || [];
  } catch {}

  const user = getCurrentUser();
  // Si admin d'agence, pre-selectionner son site
  const defaultSiteId = user?.site_id || '';

  const siteOptions = sites.map(s =>
    `<option value="${s._id}" ${s._id === defaultSiteId ? 'selected' : ''}>${s.nom}</option>`
  ).join('');

  showModal({
    title: 'Importer agents depuis CSV',
    content: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="background:#e3f2fd;border-radius:8px;padding:12px;font-size:0.82rem;color:#1565c0;">
          <i class="fa-solid fa-circle-info"></i>
          Format CSV (separateur virgule ou point-virgule) :<br>
          <code style="background:white;padding:2px 6px;border-radius:4px;font-size:0.78rem;display:block;margin-top:4px;">
            nom;prenom;type_contrat;telephone;poste
          </code>
        </div>
        <div>
          <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:6px;">Agence cible</label>
          <select id="import-site-id" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;">
            <option value="">-- Selectionner une agence --</option>
            ${siteOptions}
          </select>
        </div>
        <div>
          <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:6px;">Fichier CSV</label>
          <input id="import-file" type="file" accept=".csv,.txt"
            style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;background:white;" />
        </div>
        <div id="import-result" style="display:none;padding:10px;border-radius:8px;font-size:0.82rem;"></div>
      </div>
    `,
    confirmText: 'Importer',
    cancelText: 'Annuler',
    onConfirm: async (close) => {
      const file = document.getElementById('import-file')?.files[0];
      const siteId = document.getElementById('import-site-id')?.value;
      const resultDiv = document.getElementById('import-result');

      if (!siteId) { showToast('Selectionnez une agence.', 'warning'); return; }
      if (!file) { showToast('Selectionnez un fichier CSV.', 'warning'); return; }

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
          if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#e8f5e9';
            resultDiv.style.color = '#2e7d32';
            resultDiv.innerHTML = `
              <i class="fa-solid fa-circle-check"></i> ${data.message}
              ${data.errors?.length > 0 ? '<br><small>' + data.errors.join('<br>') + '</small>' : ''}
            `;
          }
          showToast(data.message, 'success');
          setTimeout(() => {
            close();
            // Recharger la liste agents
            window.location.hash = '#/agents';
          }, 1500);
        } else {
          showToast(data.message || 'Erreur import.', 'error');
        }
      } catch (err) {
        showToast('Erreur reseau: ' + err.message, 'error');
      }
    }
  });
}
```

S'assurer que le bouton "Importer CSV" appelle `openImportModal(root)` :
```javascript
btnImport.addEventListener('click', () => openImportModal(root));
```

---

## MISSION 2 — Fix QR Cards pour superadmin

### Problème
Le superadmin n'a pas de site_id — le bouton "QR Cards" ne sait pas quel site choisir.

### client/public/src/pages/agents.js
Modifier le handler du bouton QR Cards pour afficher un sélecteur d'agence si superadmin :

```javascript
btnQrSheet.addEventListener('click', async () => {
  const user = getCurrentUser();
  const token = localStorage.getItem('pamecas_token');

  if (user?.site_id) {
    // Admin d'agence — ouvrir directement
    window.open(`/api/agents/qr-sheet/${user.site_id}?token=${token}`, '_blank');
    return;
  }

  // Superadmin — demander quelle agence
  let sites = [];
  try {
    const res = await get('/api/sites');
    sites = res.data || res || [];
  } catch {}

  const siteOptions = sites.map(s =>
    `<option value="${s._id}">${s.nom}</option>`
  ).join('');

  showModal({
    title: 'QR Cards — Choisir une agence',
    content: `
      <div>
        <label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:8px;">Agence</label>
        <select id="qr-site-select" style="width:100%;padding:10px;border:1.5px solid #ddd;border-radius:8px;">
          <option value="">-- Selectionner --</option>
          ${siteOptions}
        </select>
      </div>
    `,
    confirmText: 'Generer QR Cards',
    cancelText: 'Annuler',
    onConfirm: (close) => {
      const siteId = document.getElementById('qr-site-select')?.value;
      if (!siteId) { showToast('Selectionnez une agence.', 'warning'); return; }
      close();
      window.open(`/api/agents/qr-sheet/${siteId}?token=${token}`, '_blank');
    }
  });
});
```

---

## Commit

```bash
git add .
git commit -m "fix: import CSV parsing manuel + QR cards selecteur agence superadmin"
git push
```
