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

  root.innerHTML = `
    <div>
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

      <!-- Bannière demandes de déconnexion — admin/superadmin only -->
      ${(user?.role === "admin" || user?.role === "superadmin") ? `
      <div id="demandes-deconnexion-banner" style="display:none;background:#fff3e0;border:1.5px solid #ffb74d;border-radius:12px;padding:12px 16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <i class="fa-solid fa-triangle-exclamation" style="color:#e65100;"></i>
          <span style="font-weight:600;color:#e65100;font-size:0.875rem;">Demandes de déconnexion en attente</span>
        </div>
        <div id="demandes-list-dashboard"></div>
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
            <div class="kpi-label"><i class="fa-solid fa-circle-check" style="color:#2e7d32;"></i> Presents</div>
            <div id="kpi-present" class="kpi-value green">0</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><i class="fa-solid fa-circle-xmark" style="color:#c62828;"></i> Absents</div>
            <div id="kpi-absent" class="kpi-value red">0</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><i class="fa-solid fa-clock" style="color:#e65100;"></i> Retards</div>
            <div id="kpi-retard" class="kpi-value orange">0</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><i class="fa-solid fa-chart-pie" style="color:#1565c0;"></i> Taux presence</div>
            <div id="kpi-taux" class="kpi-value blue">0%</div>
          </div>
        </div>

        <!-- Recapitulatif par agence -->
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:14px 16px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;">
            <h2 style="font-size:0.95rem;font-weight:600;">
              <i class="fa-solid fa-building" style="color:#2e7d32;margin-right:6px;"></i>Recapitulatif par agence
            </h2>
            <span id="recap-date" style="font-size:0.75rem;color:#aaa;"></span>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;min-width:480px;">
              <thead>
                <tr style="background:#f7faf7;">
                  <th style="padding:10px 14px;text-align:left;font-weight:600;color:#555;border-bottom:1.5px solid #eee;">Agence</th>
                  <th style="padding:10px 14px;text-align:center;font-weight:600;color:#2e7d32;border-bottom:1.5px solid #eee;">Presents</th>
                  <th style="padding:10px 14px;text-align:center;font-weight:600;color:#c62828;border-bottom:1.5px solid #eee;">Absents</th>
                  <th style="padding:10px 14px;text-align:center;font-weight:600;color:#e65100;border-bottom:1.5px solid #eee;">Retards</th>
                  <th style="padding:10px 14px;text-align:center;font-weight:600;color:#1565c0;border-bottom:1.5px solid #eee;">Taux</th>
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

      // ─── Lire data.kpis (ce que le backend envoie vraiment) ───
      const kpis = data.kpis || {};
      const presents = kpis.presents ?? data.present ?? 0;
      const absents = kpis.absents ?? data.absent ?? 0;
      const retards = kpis.retards ?? data.retard ?? 0;
      const taux = kpis.taux ?? data.taux ?? 0;

      root.querySelector("#kpi-present").textContent = presents;
      root.querySelector("#kpi-absent").textContent = absents;
      root.querySelector("#kpi-retard").textContent = retards;
      root.querySelector("#kpi-taux").textContent = `${taux}%`;

      // ─── Tableau par agence ───────────────────────────────────
      // Backend envoie par_site[].site (nom), frontend lisait sites[].nom
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
            tauxSite >= 80 ? "#2e7d32" : tauxSite >= 50 ? "#e65100" : "#c62828";

          const tr = document.createElement("tr");
          tr.style.cssText = "transition:background 0.15s;";
          tr.onmouseenter = () => (tr.style.background = "#fafff8");
          tr.onmouseleave = () => (tr.style.background = "");
          tr.innerHTML = `
            <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;font-weight:500;">${nom}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;text-align:center;">
              <span style="color:#2e7d32;font-weight:600;">${s.presents ?? 0}</span>
            </td>
            <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;text-align:center;">
              <span style="color:#c62828;font-weight:600;">${s.absents ?? 0}</span>
            </td>
            <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;text-align:center;">
              <span style="color:#e65100;font-weight:600;">${s.retards ?? 0}</span>
            </td>
            <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;text-align:center;">
              <span style="font-weight:700;color:${tauxColor};">${tauxSite}%</span>
            </td>
          `;
          body.appendChild(tr);
        });
      }

      // Date recap
      const recapDate = root.querySelector("#recap-date");
      if (recapDate)
        recapDate.textContent = new Date().toLocaleDateString("fr-FR");

      // Statut sync
      if (!navigator.onLine) {
        syncStatus.innerHTML =
          '<i class="fa-solid fa-wifi-slash"></i> Hors ligne';
        syncStatus.className = "badge badge-pending";
      } else {
        syncStatus.innerHTML =
          '<i class="fa-solid fa-circle-check"></i> A jour';
        syncStatus.className = "badge badge-synced";
      }
    } catch (err) {
      // Stop polling on auth or server-unavailable errors
      if (err && (err.status === 401 || err.status === 503)) {
        if (intervalId) {
          clearInterval(intervalId);
        }
        return;
      }

      skeleton.style.display = "none";
      content.style.display = "block";
      showToast("Impossible de charger le dashboard.", "warning");
      syncStatus.innerHTML =
        '<i class="fa-solid fa-triangle-exclamation"></i> Erreur';
      syncStatus.className = "badge badge-pending";
    }
  }

  loadData();

  // ── Demandes de déconnexion (admin/superadmin) ────────────────────
  if (user?.role === "admin" || user?.role === "superadmin") {
    async function loadDemandesDashboard() {
      try {
        const token = localStorage.getItem("pamecas_token");
        const r = await fetch("/api/agents/demandes-deconnexion", {
          headers: { Authorization: "Bearer " + token },
        });
        if (!r.ok) return;
        const data = await r.json();
        const demandes = data.data || [];
        const banner = root.querySelector("#demandes-deconnexion-banner");
        const list = root.querySelector("#demandes-list-dashboard");
        if (!banner || !list) return;
        if (!demandes.length) { banner.style.display = "none"; return; }
        banner.style.display = "block";
        list.innerHTML = demandes.map(a => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #ffe0b2;flex-wrap:wrap;" data-id="${a._id}">
            <span style="font-weight:600;font-size:0.82rem;">${a.prenom} ${a.nom}</span>
            <span style="color:#888;font-size:0.78rem;">${a.matricule}</span>
            <span style="font-size:0.78rem;color:#555;">— ${{telephone_vole:"Téléphone volé",telephone_perdu:"Téléphone perdu",telephone_detruit:"Téléphone détruit",autre:"Autre"}[a.demande_deconnexion?.motif] || "—"}</span>
            <button class="btn-approuver" data-id="${a._id}"
              style="margin-left:auto;padding:4px 10px;border-radius:7px;border:none;background:#2e7d32;color:white;font-size:0.75rem;cursor:pointer;">
              <i class="fa-solid fa-check"></i> Approuver
            </button>
          </div>
        `).join("");
        list.querySelectorAll(".btn-approuver").forEach(btn => {
          btn.addEventListener("click", async () => {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;
            const t = localStorage.getItem("pamecas_token");
            await fetch("/api/agents/" + btn.dataset.id + "/approuver-deconnexion", {
              method: "POST", headers: { Authorization: "Bearer " + t },
            });
            loadDemandesDashboard();
          });
        });
      } catch (e) { /* silencieux */ }
    }
    loadDemandesDashboard();
    setInterval(loadDemandesDashboard, 60000);
  }

  // Start polling only if a token exists
  const token = localStorage.getItem("pamecas_token");
  if (token) {
    intervalId = setInterval(() => {
      const t = localStorage.getItem("pamecas_token");
      if (!t) {
        clearInterval(intervalId);
        return;
      }
      loadData();
    }, 30000);

    // Cleanup when navigating away via hashchange
    window.addEventListener(
      "hashchange",
      () => {
        if (intervalId) clearInterval(intervalId);
      },
      { once: true },
    );
  }

  root._cleanup = () => {
    if (intervalId) clearInterval(intervalId);
  };
}
