import { get, post } from "../api.js";
import { showToast } from "../components/toast.js";
import { showModal } from "../components/modal.js";

export async function renderDemandes(root, user) {
  const isManager = user && ["admin", "superadmin", "directeur_regional"].includes(user.role);
  if (!isManager) {
    root.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:#aaa;">
        <i class="fa-solid fa-lock" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
        Accès réservé aux administrateurs.
      </div>`;
    return;
  }

  root.innerHTML = `
    <div>
      <!-- En-tête -->
      <div style="margin-bottom:16px;">
        <h1 style="font-size:1.2rem;font-weight:700;margin-bottom:4px;">
          <i class="fa-solid fa-inbox" style="color:#e65100;margin-right:8px;"></i>Demandes RH
        </h1>
        <p style="font-size:0.82rem;color:#888;margin:0;">Traitez les demandes de vos agents en attente de validation.</p>
      </div>

      <!-- Panneau : Changement d'appareil (seul objet de cette page désormais — les congés ont leur propre menu "Congés") -->
      <div id="panel-telephone">
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:14px 16px;border-bottom:1px solid #f5f5f5;background:#fff8f5;">
            <div style="font-size:0.82rem;color:#bf360c;">
              <i class="fa-solid fa-circle-info" style="margin-right:6px;"></i>
              Un agent dont la session est révoquée devra se réenregistrer depuis son nouveau téléphone.
            </div>
          </div>
          <div id="list-telephone" style="padding:8px 0;">
            <div style="text-align:center;padding:30px;color:#bbb;">
              <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
            </div>
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
          <div style="text-align:center;padding:40px 20px;color:#bbb;">
            <i class="fa-solid fa-circle-check" style="font-size:2rem;color:#a5d6a7;display:block;margin-bottom:10px;"></i>
            Aucune demande en attente.
          </div>`;
        return;
      }

      list.innerHTML = demandes.map(a => {
        const motifLabel = {
          telephone_vole: "📵 Téléphone volé",
          telephone_perdu: "🔍 Téléphone perdu",
          telephone_detruit: "💥 Téléphone détruit / HS",
          autre: "❓ Autre"
        }[a.demande_deconnexion?.motif] || a.demande_deconnexion?.motif || "—";

        const dateDemande = a.demande_deconnexion?.date_demande
          ? new Date(a.demande_deconnexion.date_demande).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
          : "—";

        return `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid #fafafa;" data-id="${a._id}">
            <!-- Avatar initiales -->
            <div style="width:40px;height:40px;border-radius:50%;background:#fff3e0;color:#e65100;font-weight:700;font-size:0.9rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${(a.prenom?.[0] || "") + (a.nom?.[0] || "")}
            </div>
            <!-- Info agent -->
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:0.9rem;">${a.prenom} ${a.nom} <span style="color:#aaa;font-size:0.78rem;font-weight:400;">${a.matricule}</span></div>
              <div style="font-size:0.78rem;color:#666;margin-top:3px;">
                <i class="fa-solid fa-building" style="color:var(--green);"></i> ${a.site_id?.nom || "—"}
                &nbsp;·&nbsp;
                <i class="fa-solid fa-mobile-screen" style="color:#888;"></i> ${a.session_device || "appareil inconnu"}
              </div>
              <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                <span style="background:#fff3e0;color:#e65100;border-radius:6px;padding:3px 8px;font-size:0.73rem;font-weight:600;">${motifLabel}</span>
                <span style="background:#f5f5f5;color:#888;border-radius:6px;padding:3px 8px;font-size:0.73rem;">Demandé le ${dateDemande}</span>
              </div>
            </div>
            <!-- Actions -->
            <div style="display:flex;gap:6px;flex-shrink:0;align-items:center;">
              <button class="btn-approuver-deco btn-primary" data-id="${a._id}"
                style="font-size:0.78rem;padding:6px 12px;background:#2e7d32;">
                <i class="fa-solid fa-check"></i> Approuver
              </button>
              <button class="btn-refuser-deco" data-id="${a._id}"
                style="font-size:0.78rem;padding:6px 12px;border-radius:8px;border:1.5px solid #c62828;background:white;color:#c62828;cursor:pointer;font-weight:500;">
                <i class="fa-solid fa-xmark"></i> Refuser
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
      list.innerHTML = `<div style="text-align:center;padding:20px;color:#c62828;">Erreur de chargement.</div>`;
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

  pollHandle = setInterval(() => loadTelephone({ silent: true }), 8000);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("hashchange", stopPolling);

  // ── Chargement initial ──────────────────────────────────────────────────────
  await loadTelephone();
}
