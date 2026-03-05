import { get } from '../api.js';
import { showToast } from '../components/toast.js';

function formatDateFr(date) {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

export function renderDashboard(root, user) {
  root.innerHTML = `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h1 style="font-size:22px; margin-bottom:4px;">Bonjour ${user?.username || ''}</h1>
          <div style="font-size:14px; color:#607d8b;">${formatDateFr(
            new Date()
          )}</div>
        </div>
        <div id="dashboard-sync-status" class="badge-synced">Données à jour</div>
      </div>
      <div id="dashboard-skeleton">
        <div class="card" style="height:80px; margin-bottom:12px; opacity:0.4;"></div>
        <div class="card" style="height:80px; margin-bottom:12px; opacity:0.4;"></div>
        <div class="card" style="height:80px; margin-bottom:12px; opacity:0.4;"></div>
      </div>
      <div id="dashboard-content" style="display:none;">
        <div style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; margin-bottom:16px;">
          <div class="card">
            <div style="font-size:13px; color:#607d8b;">Présents aujourd'hui</div>
            <div id="kpi-present" style="font-size:24px; font-weight:600; color:#2E7D32;">0</div>
          </div>
          <div class="card">
            <div style="font-size:13px; color:#607d8b;">Absents</div>
            <div id="kpi-absent" style="font-size:24px; font-weight:600; color:#E53935;">0</div>
          </div>
          <div class="card">
            <div style="font-size:13px; color:#607d8b;">Retards</div>
            <div id="kpi-retard" style="font-size:24px; font-weight:600; color:#FB8C00;">0</div>
          </div>
          <div class="card">
            <div style="font-size:13px; color:#607d8b;">Taux de présence</div>
            <div id="kpi-taux" style="font-size:24px; font-weight:600; color:#1976D2;">0%</div>
          </div>
        </div>
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h2 style="font-size:16px;">Récapitulatif par site</h2>
          </div>
          <div class="table-wrapper" style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:#f1f8e9;">
                  <th style="text-align:left; padding:6px 8px;">Site</th>
                  <th style="text-align:right; padding:6px 8px;">Présents</th>
                  <th style="text-align:right; padding:6px 8px;">Absents</th>
                  <th style="text-align:right; padding:6px 8px;">Retards</th>
                  <th style="text-align:right; padding:6px 8px;">Taux présence</th>
                </tr>
              </thead>
              <tbody id="table-sites-body">
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  async function loadData() {
    const skeleton = root.querySelector('#dashboard-skeleton');
    const content = root.querySelector('#dashboard-content');

    try {
      const data = await get('/api/rapports/dashboard-today');

      skeleton.style.display = 'none';
      content.style.display = 'block';

      const present = data.present || 0;
      const absent = data.absent || 0;
      const retard = data.retard || 0;
      const total = present + absent;
      const taux = total ? Math.round((present / total) * 100) : 0;

      root.querySelector('#kpi-present').textContent = present;
      root.querySelector('#kpi-absent').textContent = absent;
      root.querySelector('#kpi-retard').textContent = retard;
      root.querySelector('#kpi-taux').textContent = `${taux}%`;

      const body = root.querySelector('#table-sites-body');
      body.innerHTML = '';
      (data.sites || []).forEach((site) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="padding:6px 8px; border-bottom:1px solid #eee;">${site.nom}</td>
          <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${site.present}</td>
          <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${site.absent}</td>
          <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${site.retard}</td>
          <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${site.taux}%</td>
        `;
        body.appendChild(row);
      });

      const syncStatus = root.querySelector('#dashboard-sync-status');
      if (!navigator.onLine) {
        syncStatus.textContent = 'Hors ligne — dernières données connues';
        syncStatus.className = 'badge-pending';
      } else {
        syncStatus.textContent = 'Données à jour';
        syncStatus.className = 'badge-synced';
      }
    } catch (err) {
      showToast(
        "Impossible de charger le dashboard. Affichage des dernières données connues si disponibles.",
        'warning'
      );
      const skeleton = root.querySelector('#dashboard-skeleton');
      skeleton.style.display = 'none';
    }
  }

  loadData();
  const intervalId = setInterval(loadData, 30000);

  root._cleanup = () => {
    clearInterval(intervalId);
  };
}

