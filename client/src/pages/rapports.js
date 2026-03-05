import { get } from '../api.js';
import { showToast } from '../components/toast.js';

export function renderRapports(root) {
  root.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h2 style="font-size:18px;">Rapports de présence</h2>
      </div>
      <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px;">
        <div>
          <label style="font-size:13px;">Date début</label>
          <input id="date-debut" type="date" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
        </div>
        <div>
          <label style="font-size:13px;">Date fin</label>
          <input id="date-fin" type="date" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
        </div>
        <div>
          <label style="font-size:13px;">Site (optionnel)</label>
          <input id="site-code" placeholder="Code site" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cfd8dc;" />
        </div>
      </div>
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button id="btn-export-excel" class="btn-primary">Exporter Excel</button>
        <button id="btn-export-pdf" class="btn-primary">Exporter PDF</button>
      </div>
    </div>
  `;

  const dateDebut = root.querySelector('#date-debut');
  const dateFin = root.querySelector('#date-fin');
  const siteCode = root.querySelector('#site-code');

  async function exportRapport(format) {
    const debut = dateDebut.value;
    const fin = dateFin.value;
    if (!debut || !fin) {
      showToast('Veuillez choisir une date début et une date fin.', 'warning');
      return;
    }
    const params = new URLSearchParams();
    params.append('date_debut', debut);
    params.append('date_fin', fin);
    if (siteCode.value.trim()) {
      params.append('site_code', siteCode.value.trim());
    }
    params.append('format', format);

    try {
      const res = await get(`/api/rapports/export?${params.toString()}`);
      if (res && res.url) {
        window.open(res.url, '_blank');
      } else {
        showToast(
          "Le serveur n'a pas renvoyé de lien de téléchargement.",
          'warning'
        );
      }
    } catch (err) {
      showToast(
        "Erreur lors de la génération du rapport. Réessayez plus tard.",
        'error'
      );
    }
  }

  root
    .querySelector('#btn-export-excel')
    .addEventListener('click', () => exportRapport('excel'));
  root
    .querySelector('#btn-export-pdf')
    .addEventListener('click', () => exportRapport('pdf'));
}

