import { get, post } from "../api.js";
import { showToast } from "../components/toast.js";
import { showModal } from "../components/modal.js";

export async function renderDemandes(root, user) {
  const isManager = user && ["admin", "superadmin", "directeur_regional"].includes(user.role);
  if (!isManager) {
    root.innerHTML = `
      <div class="request-empty">
        <div class="empty-icon-circle" style="background:rgba(198,40,40,0.08);color:#c62828;">
          <i class="fa-solid fa-lock"></i>
        </div>
        <p>Accès réservé aux administrateurs.</p>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div>
      <!-- En-tête -->
      <div class="page-heading" style="margin-bottom:18px;">
        <div class="page-heading-icon" style="background:rgba(230,81,0,0.1);color:#e65100;">
          <i class="fa-solid fa-mobile-screen-button"></i>
        </div>
        <div>
          <h1>Demandes RH</h1>
          <p>Traitez les demandes de changement d'appareil de vos agents.</p>
        </div>
      </div>

      <!-- Panneau : Changement d'appareil (seul objet de cette page désormais — les congés ont leur propre menu "Congés") -->
      <div id="panel-telephone">
        <div class="request-alert">
          <i class="fa-solid fa-circle-info"></i>
          <span>Un agent dont la session est révoquée devra se réenregistrer depuis son nouveau téléphone.</span>
        </div>
        <div id="list-telephone">
          <div class="request-empty">
            <div class="empty-icon-circle" style="background:#f2f2f2;color:#aaa;">
              <i class="fa-solid fa-spinner fa-spin"></i>
            </div>
            <p>Chargement…</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Changement d'appareil : rendu silencieux (ne redessine que si les données changent) ──
  let lastSignature = null;

  async function loadTelephone({ silent = false } = {}) {
    const list = root.querySelector("#list-telephone");
    if (!list) return stopPolling(); // page quittée entre-temps
    try {
      const res = await get("/api/agents/demandes-deconnexion");
      const demandes = res.data || [];

      // Évite tout re-rendu (donc tout "glitch" visuel) si rien n'a changé
      const signature = JSON.stringify(demandes.map(d => d._id + (d.demande_deconnexion?.date_demande || "")));
      if (silent && signature === lastSignature) return;
      lastSignature = signature;

      if (!demandes.length) {
        list.innerHTML = `
          <div class="request-empty">
            <div class="empty-icon-circle" style="background:rgba(46,125,50,0.1);color:#2e7d32;">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <p>Aucune demande en attente.</p>
          </div>`;
        return;
      }

      list.innerHTML = demandes.map(a => {
        const motif = {
          telephone_vole: { icon: "fa-mobile-screen-button", label: "Téléphone volé" },
          telephone_perdu: { icon: "fa-magnifying-glass", label: "Téléphone perdu" },
          telephone_detruit: { icon: "fa-triangle-exclamation", label: "Téléphone détruit / HS" },
          autre: { icon: "fa-circle-question", label: "Autre" }
        }[a.demande_deconnexion?.motif] || { icon: "fa-circle-question", label: a.demande_deconnexion?.motif || "—" };

        const dateDemande = a.demande_deconnexion?.date_demande
          ? new Date(a.demande_deconnexion.date_demande).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
          : "—";

        const initials = (a.prenom?.[0] || "") + (a.nom?.[0] || "");

        return `
          <div class="request-card" data-id="${a._id}">
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <div class="request-avatar" style="background:linear-gradient(135deg,#e65100,#f57c00);">${initials}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;">
                  <span style="font-weight:600;font-size:0.92rem;color:#1f2933;">${a.prenom} ${a.nom}</span>
                  <span style="color:#aaa;font-size:0.76rem;">${a.matricule}</span>
                </div>
                <div style="font-size:0.78rem;color:#666;margin-top:4px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                  <i class="fa-solid fa-building" style="color:var(--sp-accent,var(--green));"></i> ${a.site_id?.nom || "—"}
                  <span style="color:#ddd;">·</span>
                  <i class="fa-solid fa-mobile-screen" style="color:#888;"></i> ${a.session_device || "appareil inconnu"}
                </div>
                <div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap;">
                  <span class="request-chip" style="background:#fff3e0;color:#e65100;"><i class="fa-solid ${motif.icon}"></i> ${motif.label}</span>
                  <span class="request-chip" style="background:#f5f5f5;color:#888;font-weight:500;">Demandé le ${dateDemande}</span>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;padding-top:12px;border-top:1px solid #f5f5f5;">
              <button class="btn-reject-pill btn-refuser-deco" data-id="${a._id}">
                <i class="fa-solid fa-xmark"></i> Refuser
              </button>
              <button class="btn-approve-pill btn-approuver-deco" data-id="${a._id}">
                <i class="fa-solid fa-check"></i> Approuver
              </button>
            </div>
          </div>
        `;
      }).join("");

      // Handlers
      list.querySelectorAll(".btn-approuver-deco").forEach(btn => {
        btn.addEventListener("click", async () => {
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
          btn.disabled = true;
          try {
            const res = await post(`/api/agents/${btn.dataset.id}/approuver-deconnexion`, {});
            showToast(res.message || "Session révoquée — l'agent peut se reconnecter.", "success");
            loadTelephone();
          } catch (err) {
            showToast(err.message || "Erreur.", "error");
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Approuver';
            btn.disabled = false;
          }
        });
      });

      list.querySelectorAll(".btn-refuser-deco").forEach(btn => {
        btn.addEventListener("click", async () => {
          showModal({
            title: "Refuser la demande",
            content: `
              <p style="color:#555;margin-bottom:12px;">Confirmer le refus de cette demande de changement d'appareil ?</p>
              <textarea id="motif-refus" rows="2" placeholder="Motif du refus (optionnel)"
                style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;resize:vertical;box-sizing:border-box;font-size:0.85rem;font-family:inherit;"></textarea>
            `,
            confirmText: "Refuser",
            cancelText: "Annuler",
            onConfirm: async (close) => {
              try {
                const res = await post(`/api/agents/${btn.dataset.id}/refuser-deconnexion`, {
                  motif: document.getElementById("motif-refus")?.value || ""
                });
                showToast(res.message || "Demande refusée.", "success");
                close();
                loadTelephone();
              } catch (err) {
                showToast(err.message || "Erreur.", "error");
              }
            }
          });
        });
      });

    } catch (err) {
      list.innerHTML = `<div class="request-empty"><p style="color:#c62828;">Erreur de chargement.</p></div>`;
    }
  }

  // ── Polling silencieux : le badge/liste se met à jour tout seul, sans refresh manuel ──
  let pollHandle = null;
  function stopPolling() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("hashchange", stopPolling);
  }
  function onVisibility() {
    if (!document.hidden) loadTelephone({ silent: true });
  }

  pollHandle = setInterval(() => {
    if (!root.isConnected) { stopPolling(); return; }
    loadTelephone({ silent: true });
  }, 8000);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("hashchange", stopPolling);

  // ── Chargement initial ──────────────────────────────────────────────────────
  await loadTelephone();
}
