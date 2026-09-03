import { get } from "../api.js";
import { showToast } from "../components/toast.js";

function formatDateFr(date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function renderDashboard(root, user) {
  const roleLabel =
    {
      superadmin: "Toutes les agences",
      directeur_regional: "Vos agences",
      admin: user?.site_nom || "Votre agence",
      pointeur: user?.site_nom || "Votre agence",
      superviseur: user?.site_nom || "Votre agence",
    }[user?.role] || "";

  const isManager = user?.role === "admin" || user?.role === "superadmin" || user?.role === "directeur_regional";

  root.innerHTML = `
    <div>
      <!-- En-tête -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div>
          <h1 style="font-size:1.3rem;font-weight:700;margin-bottom:4px;">Bonjour ${user?.username || ""}</h1>
          <div style="font-size:0.85rem;color:#607d8b;">${formatDateFr(new Date())}</div>
          ${roleLabel ? `<div style="font-size:0.78rem;color:#aaa;margin-top:2px;"><i class="fa-solid fa-building" style="margin-right:4px;"></i>${roleLabel}</div>` : ""}
        </div>
        <div id="dashboard-sync-status" class="badge badge-synced" style="font-size:0.75rem;">
          <i class="fa-solid fa-circle-check"></i> A jour
        </div>
      </div>

      <!-- Tuiles de notification demandes (admin/superadmin/DR) -->
      ${isManager ? `
      <div id="notifications-row" style="display:none;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <div id="notif-deconnexions" style="display:none;flex:1;min-width:160px;background:#fff3e0;border:1.5px solid #ffb74d;border-radius:12px;padding:12px 16px;cursor:pointer;transition:box-shadow 0.2s;"
          onclick="window.location.hash='#/demandes'">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="background:#e65100;color:white;border-radius:8px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">
              <i class="fa-solid fa-mobile-screen"></i>
            </div>
            <div>
              <div id="notif-deconnexions-count" style="font-size:1.25rem;font-weight:700;color:#e65100;line-height:1;">0</div>
              <div style="font-size:0.72rem;color:#bf360c;font-weight:600;">Chgt. téléphone</div>
            </div>
            <i class="fa-solid fa-arrow-right" style="color:#ffb74d;margin-left:auto;font-size:0.8rem;"></i>
          </div>
        </div>

        <div id="notif-conges" style="display:none;flex:1;min-width:160px;background:#e8f5e9;border:1.5px solid #81c784;border-radius:12px;padding:12px 16px;cursor:pointer;transition:box-shadow 0.2s;"
          onclick="window.location.hash='#/demandes'">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="background:#2e7d32;color:white;border-radius:8px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">
              <i class="fa-solid fa-calendar-days"></i>
            </div>
            <div>
              <div id="notif-conges-count" style="font-size:1.25rem;font-weight:700;color:#2e7d32;line-height:1;">0</div>
              <div style="font-size:0.72rem;color:#1b5e20;font-weight:600;">Congés en attente</div>
            </div>
            <i class="fa-solid fa-arrow-right" style="color:#81c784;margin-left:auto;font-size:0.8rem;"></i>
          </div>
        </div>
      </div>` : ""}

      <!-- KPI skeleton -->
      <div id="dashboard-skeleton">
        <div class="kpi-grid" style="margin-bottom:16px;">
          ${[1, 2, 3, 4].map(() => `<div class="kpi-card" style="opacity:0.3;min-height:80px;"></div>`).join("")}
        </div>
        <div class="card" style="opacity:0.3;min-height:120px;"></div>
      </div>

      <!-- Contenu reel -->
      <div id="dashboard-content" style="display:none;">
        <div class="kpi-grid" style="margin-bottom:16px;">
          <div class="kpi-card">
            <div class="kpi-label"><i class="fa-solid fa-circle-check" style="color:var(--sp-accent);"></i> Presents</div>
            <div id="kpi-present" class="kpi-value green">0</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><i class="fa-solid fa-circle-xmark" style="color:#c62828;"></i> Absents</div>
            <div id="kpi-absent" class="kpi-value red">0</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><i class="fa-solid fa-clock" style="color:var(--sp-warning);"></i> Retards</div>
            <div id="kpi-retard" class="kpi-value orange">0</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><i class="fa-solid fa-chart-pie" style="color:var(--sp-accent);"></i> Taux presence</div>
            <div id="kpi-taux" class="kpi-value blue">0%</div>
          </div>
        </div>

        <!-- Recapitulatif par agence -->
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:14px 16px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;">
            <h2 style="font-size:0.95rem;font-weight:600;">
              <i class="fa-solid fa-building" style="color:var(--sp-accent);margin-right:6px;"></i>Recapitulatif par agence
            </h2>
            <span id="recap-date" style="font-size:0.75rem;color:#aaa;"></span>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;min-width:480px;">
              <thead>
                <tr style="background:#f7faf7;">
                  <th style="padding:10px 14px;text-align:left;font-weight:600;color:#555;border-bottom:1.5px solid #eee;">Agence</th>
                  <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--sp-accent);border-bottom:1.5px solid #eee;">Presents</th>
                  <th style="padding:10px 14px;text-align:center;font-weight:600;color:#c62828;border-bottom:1.5px solid #eee;">Absents</th>
                  <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--sp-warning);border-bottom:1.5px solid #eee;">Retards</th>
                  <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--sp-accent);border-bottom:1.5px solid #eee;">Taux</th>
                </tr>
              </thead>
              <tbody id="table-sites-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  let intervalId;

  async function loadData() {
    if (!localStorage.getItem("pamecas_token")) return;
    const skeleton = root.querySelector("#dashboard-skeleton");
    const content = root.querySelector("#dashboard-content");
    const syncStatus = root.querySelector("#dashboard-sync-status");

    try {
      const data = await get("/api/rapports/dashboard-today");

      skeleton.style.display = "none";
      content.style.display = "block";

      const kpis = data.kpis || {};
      const presents = kpis.presents ?? data.present ?? 0;
      const absents = kpis.absents ?? data.absent ?? 0;
      const retards = kpis.retards ?? data.retard ?? 0;
      const taux = kpis.taux ?? data.taux ?? 0;

      root.querySelector("#kpi-present").textContent = presents;
      root.querySelector("#kpi-absent").textContent = absents;
      root.querySelector("#kpi-retard").textContent = retards;
      root.querySelector("#kpi-taux").textContent = `${taux}%`;

      const parSite = data.par_site || data.sites || [];
      const body = root.querySelector("#table-sites-body");
      body.innerHTML = "";

      if (parSite.length === 0) {
        body.innerHTML = `
          <tr><td colspan="5" style="text-align:center;padding:20px;color:#bbb;">
            <i class="fa-regular fa-calendar-xmark"></i> Aucun pointage aujourd'hui
          </td></tr>
        `;
      } else {
        parSite.forEach((s) => {
          const nom = s.site || s.nom || "Agence inconnue";
          const tauxSite = s.taux ?? 0;
          const tauxColor =
            tauxSite >= 80 ? "var(--sp-accent)" : tauxSite >= 50 ? "var(--sp-warning)" : "#c62828";

          const tr = document.createElement("tr");
          tr.style.cssText = "transition:background 0.15s;";
          tr.onmouseenter = () => (tr.style.background = "#fafff8");
          tr.onmouseleave = () => (tr.style.background = "");
          tr.innerHTML = `
            <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;font-weight:500;">${nom}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;text-align:center;">
              <span style="color:var(--sp-accent);font-weight:600;">${s.presents ?? 0}</span>
            </td>
            <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;text-align:center;">
              <span style="color:#c62828;font-weight:600;">${s.absents ?? 0}</span>
            </td>
            <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;text-align:center;">
              <span style="color:var(--sp-warning);font-weight:600;">${s.retards ?? 0}</span>
            </td>
            <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;text-align:center;">
              <span style="font-weight:700;color:${tauxColor};">${tauxSite}%</span>
            </td>
          `;
          body.appendChild(tr);
        });
      }

      const recapDate = root.querySelector("#recap-date");
      if (recapDate) recapDate.textContent = new Date().toLocaleDateString("fr-FR");

      if (!navigator.onLine) {
        syncStatus.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> Hors ligne';
        syncStatus.className = "badge badge-pending";
      } else {
        syncStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> A jour';
        syncStatus.className = "badge badge-synced";
      }
    } catch (err) {
      if (err && (err.status === 401 || err.status === 503)) {
        if (intervalId) clearInterval(intervalId);
        return;
      }
      skeleton.style.display = "none";
      content.style.display = "block";
      showToast("Impossible de charger le dashboard.", "warning");
      syncStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Erreur';
      syncStatus.className = "badge badge-pending";
    }
  }

  loadData();

  // ── Tuiles de notification (admin/superadmin/DR) ──────────────────────────
  if (isManager) {
    async function loadNotifications() {
      try {
        const token = localStorage.getItem("pamecas_token");
        const notifRow = root.querySelector("#notifications-row");
        const notifDecoCard = root.querySelector("#notif-deconnexions");
        const notifCongesCard = root.querySelector("#notif-conges");

        // Demandes de déconnexion
        if (user?.role === "admin" || user?.role === "superadmin") {
          try {
            const r = await fetch("/api/agents/demandes-deconnexion", {
              headers: { Authorization: "Bearer " + token },
            });
            if (r.ok) {
              const data = await r.json();
              const nb = (data.data || []).length;
              const countEl = root.querySelector("#notif-deconnexions-count");
              if (countEl) countEl.textContent = nb;
              if (notifDecoCard) notifDecoCard.style.display = nb > 0 ? "block" : "none";
            }
          } catch { /* silencieux */ }
        }

        // Congés en attente
        try {
          const r = await fetch("/api/conges?statut=en_attente", {
            headers: { Authorization: "Bearer " + token },
          });
          if (r.ok) {
            const data = await r.json();
            const nb = (data.data || []).length;
            const countEl = root.querySelector("#notif-conges-count");
            if (countEl) countEl.textContent = nb;
            if (notifCongesCard) notifCongesCard.style.display = nb > 0 ? "block" : "none";
          }
        } catch { /* silencieux */ }

        // Afficher la row si au moins une tuile est visible
        if (notifRow) {
          const anyVisible =
            (notifDecoCard?.style.display !== "none") ||
            (notifCongesCard?.style.display !== "none");
          notifRow.style.display = anyVisible ? "flex" : "none";
        }
      } catch (e) { /* silencieux */ }
    }

    loadNotifications();
    setInterval(loadNotifications, 60000);
  }

  // Polling données KPI
  const token = localStorage.getItem("pamecas_token");
  if (token) {
    intervalId = setInterval(() => {
      const t = localStorage.getItem("pamecas_token");
      if (!t) { clearInterval(intervalId); return; }
      loadData();
    }, 30000);

    window.addEventListener("hashchange", () => {
      if (intervalId) clearInterval(intervalId);
    }, { once: true });
  }

  root._cleanup = () => {
    if (intervalId) clearInterval(intervalId);
  };
}
