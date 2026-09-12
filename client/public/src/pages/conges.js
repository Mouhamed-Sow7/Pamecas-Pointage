import { get } from "../api.js";
import { showToast } from "../components/toast.js";
import { showModal } from "../components/modal.js";

export async function renderConges(root, user) {
  function fmtDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const FILTERS = [
    { value: "en_attente", label: "En attente" },
    { value: "", label: "Toutes" },
    { value: "approuve", label: "Approuvées" },
    { value: "refuse", label: "Refusées" },
  ];
  let currentFilter = "en_attente";

  root.innerHTML = `
    <div>
      <div class="request-toolbar">
        <div class="page-heading">
          <div class="page-heading-icon" style="background:rgba(46,125,50,0.1);color:var(--sp-accent,#2e7d32);">
            <i class="fa-solid fa-calendar-days"></i>
          </div>
          <div>
            <h1>Demandes de congé</h1>
            <p>Approuvez ou refusez les congés soumis par vos agents.</p>
          </div>
        </div>
        <div class="filter-pills" id="filtre-statut-conge" role="tablist">
          ${FILTERS.map(f => `
            <button type="button" class="filter-pill${f.value === currentFilter ? " active" : ""}" data-value="${f.value}">${f.label}</button>
          `).join("")}
        </div>
      </div>

      <!-- Stats rapides -->
      <div id="conges-stats" class="stat-chip-row">
        <div class="stat-chip">
          <div class="stat-chip-icon" style="background:rgba(230,81,0,0.1);color:#e65100;"><i class="fa-solid fa-clock"></i></div>
          <div>
            <div class="stat-chip-value" style="color:#e65100;" id="stat-attente">—</div>
            <div class="stat-chip-label">En attente</div>
          </div>
        </div>
        <div class="stat-chip">
          <div class="stat-chip-icon" style="background:rgba(46,125,50,0.1);color:#2e7d32;"><i class="fa-solid fa-circle-check"></i></div>
          <div>
            <div class="stat-chip-value" style="color:#2e7d32;" id="stat-approuve">—</div>
            <div class="stat-chip-label">Approuvées</div>
          </div>
        </div>
        <div class="stat-chip">
          <div class="stat-chip-icon" style="background:rgba(198,40,40,0.1);color:#c62828;"><i class="fa-solid fa-circle-xmark"></i></div>
          <div>
            <div class="stat-chip-value" style="color:#c62828;" id="stat-refuse">—</div>
            <div class="stat-chip-label">Refusées</div>
          </div>
        </div>
      </div>

      <div id="conges-list" style="max-height:calc(100vh - 320px);overflow-y:auto;">
        <div class="request-empty">
          <div class="empty-icon-circle" style="background:#f2f2f2;color:#aaa;">
            <i class="fa-solid fa-spinner fa-spin"></i>
          </div>
          <p>Chargement…</p>
        </div>
      </div>
    </div>
  `;

  async function loadStats() {
    try {
      const [rA, rR, rT] = await Promise.all([
        get("/api/conges?statut=en_attente"),
        get("/api/conges?statut=approuve"),
        get("/api/conges?statut=refuse"),
      ]);
      const el = (id) => document.getElementById(id);
      if (el("stat-attente")) el("stat-attente").textContent = (rA.data || []).length;
      if (el("stat-approuve")) el("stat-approuve").textContent = (rR.data || []).length;
      if (el("stat-refuse")) el("stat-refuse").textContent = (rT.data || []).length;
    } catch { /* silencieux */ }
  }

  let lastSignature = null;

  async function loadConges({ silent = false } = {}) {
    const statut = currentFilter;
    const list = document.getElementById("conges-list");
    if (!list) return stopPolling(); // page quittée

    try {
      const url = `/api/conges${statut ? `?statut=${statut}` : ""}`;
      const res = await get(url);
      const conges = res.data || [];

      const signature = JSON.stringify(conges.map((c) => c._id + c.statut));
      if (silent && signature === lastSignature) return;
      lastSignature = signature;

      if (!conges.length) {
        list.innerHTML = `
          <div class="request-empty">
            <div class="empty-icon-circle" style="background:rgba(46,125,50,0.1);color:#2e7d32;">
              <i class="fa-solid fa-mug-hot"></i>
            </div>
            <p>Aucune demande dans cette catégorie.</p>
          </div>`;
        return;
      }

      const statutColors = {
        en_attente: { bg: "#fff3e0", color: "#e65100", label: "En attente" },
        approuve: { bg: "#e8f5e9", color: "#2e7d32", label: "Approuvé" },
        refuse: { bg: "#ffebee", color: "#c62828", label: "Refusé" },
      };

      list.innerHTML = conges
        .map((c) => {
          const sc = statutColors[c.statut] || statutColors.en_attente;
          const agent = c.agent_id || {};
          const initials = (agent.prenom?.[0] || "") + (agent.nom?.[0] || "");
          return `
          <div class="request-card" style="border-left:3px solid ${sc.color};" data-id="${c._id}">
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <div class="request-avatar">${initials || "?"}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                  <div>
                    <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;">
                      <span style="font-weight:600;font-size:0.92rem;color:#1f2933;">${agent.prenom || ""} ${agent.nom || ""}</span>
                      <span style="color:#aaa;font-size:0.76rem;">${agent.matricule || ""}${c.site_id?.nom ? " · " + c.site_id.nom : ""}</span>
                    </div>
                    <div style="font-size:0.82rem;margin-top:6px;color:#444;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                      <i class="fa-solid fa-calendar-range" style="color:var(--sp-accent,#2e7d32);"></i>
                      ${fmtDate(c.date_debut)} → ${fmtDate(c.date_fin)}
                      <span class="request-chip" style="background:#f5f5f5;color:#555;">${c.nb_jours} jour(s)</span>
                    </div>
                    ${c.motif ? `<div style="font-size:0.78rem;color:#888;margin-top:4px;">Motif : ${c.motif}</div>` : ""}
                  </div>
                  <span class="request-chip" style="background:${sc.bg};color:${sc.color};flex-shrink:0;">${sc.label}</span>
                </div>
                ${c.commentaire_rh ? `<div style="font-size:0.78rem;color:#888;margin-top:10px;padding:8px 10px;background:#fafafa;border-radius:8px;border-left:2px solid #ddd;">Note RH : ${c.commentaire_rh}</div>` : ""}
                ${c.statut === "en_attente" ? `
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;padding-top:12px;border-top:1px solid #f5f5f5;">
                  <button class="btn-reject-pill btn-refuser" data-id="${c._id}">
                    <i class="fa-solid fa-xmark"></i> Refuser
                  </button>
                  <button class="btn-approve-pill btn-approuver" data-id="${c._id}">
                    <i class="fa-solid fa-check"></i> Approuver
                  </button>
                </div>` : ""}
              </div>
            </div>
          </div>
        `;
        })
        .join("");

      // Events
      list.querySelectorAll(".btn-approuver, .btn-refuser").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.classList.contains("btn-approuver")
            ? "approuve"
            : "refuse";
          traiterDemande(btn.dataset.id, action);
        });
      });
    } catch (err) {
      list.innerHTML = `<div class="request-empty"><p style="color:#c62828;">Erreur de chargement.</p></div>`;
    }
  }

  function traiterDemande(id, action) {
    showModal({
      title:
        action === "approuve" ? "Approuver la demande" : "Refuser la demande",
      content: `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <p style="margin:0;color:#555;">
            ${action === "approuve" ? "Confirmer l'approbation de cette demande de congé ?" : "Confirmer le refus de cette demande ?"}
          </p>
          <div>
            <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:5px;">
              Commentaire RH (optionnel)
            </label>
            <textarea id="commentaire-rh" rows="2"
              placeholder="Ex: Approuvé selon planning / Refusé pour raison de service..."
              style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;resize:vertical;box-sizing:border-box;font-size:0.85rem;font-family:inherit;"></textarea>
          </div>
        </div>
      `,
      confirmText: action === "approuve" ? "Approuver" : "Refuser",
      cancelText: "Annuler",
      onConfirm: async (close) => {
        const commentaire =
          document.getElementById("commentaire-rh")?.value || "";
        try {
          const token = localStorage.getItem("pamecas_token");
          const res = await fetch(`/api/conges/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              statut: action,
              commentaire_rh: commentaire,
            }),
          });
          if (!res.ok) throw new Error((await res.json()).message);
          showToast(
            `Demande ${action === "approuve" ? "approuvée" : "refusée"}.`,
            "success",
          );
          close();
          await loadConges();
        } catch (err) {
          showToast(err.message || "Erreur.", "error");
        }
      },
    });
  }

  document.getElementById("filtre-statut-conge")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-pill");
    if (!btn) return;
    currentFilter = btn.dataset.value;
    document
      .querySelectorAll("#filtre-statut-conge .filter-pill")
      .forEach((p) => p.classList.toggle("active", p === btn));
    lastSignature = null; // force le redessin même si la liste sous-jacente n'a pas changé
    loadConges();
  });

  let pollHandle = setInterval(() => {
    if (!root.isConnected) { stopPolling(); return; }
    loadConges({ silent: true }); loadStats();
  }, 8000);
  function stopPolling() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
    window.removeEventListener("hashchange", stopPolling);
  }
  window.addEventListener("hashchange", stopPolling);

  await loadConges();
  await loadStats();
}
