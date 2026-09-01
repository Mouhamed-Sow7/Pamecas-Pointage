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
  root.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <h2 style="font-size:1.1rem;font-weight:700;">
          <i class="fa-solid fa-calendar-days" style="color:#2e7d32;margin-right:6px;"></i>Demandes de congé
        </h2>
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="filtre-statut-conge" style="padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;">
            <option value="en_attente">En attente</option>
            <option value="">Toutes</option>
            <option value="approuve">Approuvées</option>
            <option value="refuse">Refusées</option>
          </select>
        </div>
      </div>

      <!-- Stats rapides -->
      <div id="conges-stats" style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <div style="background:#fff3e0;border-radius:8px;padding:8px 14px;font-size:0.78rem;font-weight:600;color:#e65100;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-clock"></i>
          <span id="stat-attente">—</span> en attente
        </div>
        <div style="background:#e8f5e9;border-radius:8px;padding:8px 14px;font-size:0.78rem;font-weight:600;color:#2e7d32;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-circle-check"></i>
          <span id="stat-approuve">—</span> approuvées
        </div>
        <div style="background:#ffebee;border-radius:8px;padding:8px 14px;font-size:0.78rem;font-weight:600;color:#c62828;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-circle-xmark"></i>
          <span id="stat-refuse">—</span> refusées
        </div>
      </div>

      <div id="conges-list" style="display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 260px);overflow-y:auto;">
        <div style="text-align:center;padding:20px;color:#999;">
          <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
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
    const statut = document.getElementById("filtre-statut-conge")?.value ?? "en_attente";
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
        list.innerHTML = `<div style="text-align:center;padding:32px;color:#bbb;">Aucune demande</div>`;
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
          return `
          <div style="background:white;border-radius:10px;padding:14px;border:1px solid #eee;border-left:3px solid ${sc.color};">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;flex-wrap:wrap;">
              <div>
                <div style="font-weight:600;font-size:0.88rem;">${agent.nom || ""} ${agent.prenom || ""}</div>
                <div style="font-size:0.75rem;color:#888;">${agent.matricule || ""} · ${c.site_id?.nom || ""}</div>
                <div style="font-size:0.82rem;margin-top:6px;color:#444;">
                  <i class="fa-solid fa-calendar-range" style="color:#2e7d32;"></i>
                  ${fmtDate(c.date_debut)} → ${fmtDate(c.date_fin)}
                  <strong>(${c.nb_jours} jours)</strong>
                </div>
                ${c.motif ? `<div style="font-size:0.75rem;color:#888;margin-top:3px;">Motif: ${c.motif}</div>` : ""}
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                <span style="padding:3px 10px;border-radius:10px;background:${sc.bg};color:${sc.color};font-size:0.72rem;font-weight:600;white-space:nowrap;">
                  ${sc.label}
                </span>
                ${
                  c.statut === "en_attente"
                    ? `
                  <div style="display:flex;gap:5px;">
                    <button class="btn-approuver" data-id="${c._id}"
                      style="padding:5px 10px;background:#2e7d32;color:white;border:none;border-radius:6px;font-size:0.72rem;cursor:pointer;">
                      ✅ Approuver
                    </button>
                    <button class="btn-refuser" data-id="${c._id}"
                      style="padding:5px 10px;background:#c62828;color:white;border:none;border-radius:6px;font-size:0.72rem;cursor:pointer;">
                      ❌ Refuser
                    </button>
                  </div>
                `
                    : ""
                }
              </div>
            </div>
            ${c.commentaire_rh ? `<div style="font-size:0.75rem;color:#888;margin-top:6px;padding-top:6px;border-top:1px solid #f0f0f0;">Note RH: ${c.commentaire_rh}</div>` : ""}
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
      list.innerHTML = `<div style="text-align:center;padding:20px;color:#c62828;">Erreur chargement</div>`;
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

  document
    .getElementById("filtre-statut-conge")
    ?.addEventListener("change", () => loadConges());

  let pollHandle = setInterval(() => { loadConges({ silent: true }); loadStats(); }, 8000);
  function stopPolling() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
    window.removeEventListener("hashchange", stopPolling);
  }
  window.addEventListener("hashchange", stopPolling);

  await loadConges();
  await loadStats();
}
