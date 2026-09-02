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

      <!-- Sous-onglets -->
      <div style="display:flex;gap:0;border-bottom:2px solid #f0f0f0;margin-bottom:16px;">
        <button id="tab-telephone" class="demandes-tab demandes-tab-active">
          <i class="fa-solid fa-mobile-screen"></i>
          Changement d'appareil
          <span id="badge-telephone" style="display:none;background:#c62828;color:white;border-radius:999px;font-size:0.6rem;font-weight:700;padding:1px 6px;margin-left:6px;vertical-align:middle;">0</span>
        </button>
        <button id="tab-conges" class="demandes-tab">
          <i class="fa-solid fa-calendar-days"></i>
          Congés
          <span id="badge-conges" style="display:none;background:#c62828;color:white;border-radius:999px;font-size:0.6rem;font-weight:700;padding:1px 6px;margin-left:6px;vertical-align:middle;">0</span>
        </button>
      </div>

      <!-- Panneau : Changement d'appareil -->
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

      <!-- Panneau : Congés -->
      <div id="panel-conges" style="display:none;">
        <!-- Stats rapides -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <div style="background:#fff3e0;border-radius:8px;padding:8px 14px;font-size:0.78rem;font-weight:600;color:#e65100;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-clock"></i> <span id="stat-attente">—</span> en attente
          </div>
          <div style="background:#e8f5e9;border-radius:8px;padding:8px 14px;font-size:0.78rem;font-weight:600;color:#2e7d32;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-circle-check"></i> <span id="stat-approuve">—</span> approuvées
          </div>
          <div style="background:#ffebee;border-radius:8px;padding:8px 14px;font-size:0.78rem;font-weight:600;color:#c62828;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-circle-xmark"></i> <span id="stat-refuse">—</span> refusées
          </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:12px 16px;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.82rem;font-weight:600;color:#555;">Filtrer par statut</span>
            <select id="filtre-conge" style="padding:6px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.82rem;">
              <option value="en_attente">En attente</option>
              <option value="">Toutes</option>
              <option value="approuve">Approuvées</option>
              <option value="refuse">Refusées</option>
            </select>
          </div>
          <div id="list-conges" style="padding:8px 0;">
            <div style="text-align:center;padding:30px;color:#bbb;">
              <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Styles onglets ──────────────────────────────────────────────────────────
  if (!document.getElementById("demandes-tab-style")) {
    const style = document.createElement("style");
    style.id = "demandes-tab-style";
    style.textContent = `
      .demandes-tab {
        padding: 10px 20px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 600;
        color: #aaa;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        transition: color 0.15s, border-color 0.15s;
      }
      .demandes-tab:hover { color: #555; }
      .demandes-tab-active { color: #e65100; border-bottom: 2px solid #e65100; }
    `;
    document.head.appendChild(style);
  }

  // ── Navigation onglets ──────────────────────────────────────────────────────
  const tabTel = root.querySelector("#tab-telephone");
  const tabCon = root.querySelector("#tab-conges");
  const panelTel = root.querySelector("#panel-telephone");
  const panelCon = root.querySelector("#panel-conges");

  function activateTab(tab) {
    const isTel = tab === "telephone";
    tabTel.className = "demandes-tab" + (isTel ? " demandes-tab-active" : "");
    tabCon.className = "demandes-tab" + (!isTel ? " demandes-tab-active" : "");
    panelTel.style.display = isTel ? "block" : "none";
    panelCon.style.display = isTel ? "none" : "block";
    if (!isTel) loadConges();
  }

  tabTel.addEventListener("click", () => activateTab("telephone"));
  tabCon.addEventListener("click", () => activateTab("conges"));

  // ── Panel 1 : Changement d'appareil ────────────────────────────────────────
  async function loadTelephone() {
    const list = root.querySelector("#list-telephone");
    const badge = root.querySelector("#badge-telephone");
    try {
      const res = await get("/api/agents/demandes-deconnexion");
      const demandes = res.data || [];

      // Badge onglet
      if (demandes.length > 0) {
        badge.textContent = demandes.length > 9 ? "9+" : demandes.length;
        badge.style.display = "inline";
      } else {
        badge.style.display = "none";
      }

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

  // ── Panel 2 : Congés ────────────────────────────────────────────────────────
  async function loadStats() {
    try {
      const [rA, rR, rT] = await Promise.all([
        get("/api/conges?statut=en_attente"),
        get("/api/conges?statut=approuve"),
        get("/api/conges?statut=refuse"),
      ]);
      const el = id => root.querySelector(id);
      const nbAttente = (rA.data || []).length;
      if (el("#stat-attente")) el("#stat-attente").textContent = nbAttente;
      if (el("#stat-approuve")) el("#stat-approuve").textContent = (rR.data || []).length;
      if (el("#stat-refuse")) el("#stat-refuse").textContent = (rT.data || []).length;

      // Badge onglet congés
      const badgeCon = root.querySelector("#badge-conges");
      if (badgeCon) {
        if (nbAttente > 0) { badgeCon.textContent = nbAttente > 9 ? "9+" : nbAttente; badgeCon.style.display = "inline"; }
        else { badgeCon.style.display = "none"; }
      }
    } catch { /* silencieux */ }
  }

  function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  async function loadConges() {
    const statut = root.querySelector("#filtre-conge")?.value ?? "en_attente";
    const list = root.querySelector("#list-conges");
    if (!list) return;

    list.innerHTML = `<div style="text-align:center;padding:30px;color:#bbb;"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    try {
      const res = await get(`/api/conges${statut ? `?statut=${statut}` : ""}`);
      const conges = res.data || [];

      if (!conges.length) {
        list.innerHTML = `
          <div style="text-align:center;padding:40px 20px;color:#bbb;">
            <i class="fa-solid fa-calendar-check" style="font-size:2rem;color:#a5d6a7;display:block;margin-bottom:10px;"></i>
            Aucune demande${statut === "en_attente" ? " en attente" : ""}.
          </div>`;
        return;
      }

      list.innerHTML = conges.map(c => {
        const statutBadge = {
          en_attente: `<span style="background:#fff3e0;color:#e65100;border-radius:6px;padding:3px 8px;font-size:0.72rem;font-weight:600;"><i class="fa-solid fa-clock"></i> En attente</span>`,
          approuve:   `<span style="background:#e8f5e9;color:#2e7d32;border-radius:6px;padding:3px 8px;font-size:0.72rem;font-weight:600;"><i class="fa-solid fa-circle-check"></i> Approuvée</span>`,
          refuse:     `<span style="background:#ffebee;color:#c62828;border-radius:6px;padding:3px 8px;font-size:0.72rem;font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> Refusée</span>`,
        }[c.statut] || "";

        return `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid #fafafa;">
            <!-- Avatar -->
            <div style="width:40px;height:40px;border-radius:50%;background:#e8f5e9;color:#2e7d32;font-weight:700;font-size:0.9rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${(c.agent_id?.prenom?.[0] || "") + (c.agent_id?.nom?.[0] || "?")}
            </div>
            <!-- Info -->
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:0.9rem;">${c.agent_id?.prenom || "—"} ${c.agent_id?.nom || ""} <span style="color:#aaa;font-size:0.78rem;font-weight:400;">${c.agent_id?.matricule || ""}</span></div>
              <div style="font-size:0.78rem;color:#666;margin-top:3px;">
                <i class="fa-solid fa-calendar-range" style="color:var(--green);"></i>
                Du ${fmtDate(c.date_debut)} au ${fmtDate(c.date_fin)}
                &nbsp;·&nbsp;
                <strong>${c.nb_jours || "?"} jours</strong>
              </div>
              <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                ${statutBadge}
                ${c.motif ? `<span style="background:#f5f5f5;color:#888;border-radius:6px;padding:3px 8px;font-size:0.73rem;">${c.motif}</span>` : ""}
              </div>
              ${c.commentaire_rh ? `<div style="font-size:0.75rem;color:#888;margin-top:6px;"><i class="fa-solid fa-comment" style="margin-right:4px;"></i>${c.commentaire_rh}</div>` : ""}
            </div>
            <!-- Actions (seulement si en attente) -->
            ${c.statut === "en_attente" ? `
            <div style="display:flex;gap:6px;flex-shrink:0;align-items:center;">
              <button class="btn-approuver-conge btn-primary" data-id="${c._id}"
                style="font-size:0.78rem;padding:6px 12px;background:#2e7d32;">
                <i class="fa-solid fa-check"></i> Approuver
              </button>
              <button class="btn-refuser-conge" data-id="${c._id}"
                style="font-size:0.78rem;padding:6px 12px;border-radius:8px;border:1.5px solid #c62828;background:white;color:#c62828;cursor:pointer;font-weight:500;">
                <i class="fa-solid fa-xmark"></i> Refuser
              </button>
            </div>` : ""}
          </div>
        `;
      }).join("");

      // Handlers congés
      list.querySelectorAll(".btn-approuver-conge, .btn-refuser-conge").forEach(btn => {
        btn.addEventListener("click", () => {
          const action = btn.classList.contains("btn-approuver-conge") ? "approuve" : "refuse";
          traiterConge(btn.dataset.id, action);
        });
      });

    } catch {
      list.innerHTML = `<div style="text-align:center;padding:20px;color:#c62828;">Erreur de chargement.</div>`;
    }
  }

  function traiterConge(id, action) {
    showModal({
      title: action === "approuve" ? "Approuver le congé" : "Refuser le congé",
      content: `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <p style="margin:0;color:#555;">
            ${action === "approuve" ? "Confirmer l'approbation de cette demande de congé ?" : "Confirmer le refus de cette demande ?"}
          </p>
          <div>
            <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:5px;">Commentaire RH (optionnel)</label>
            <textarea id="commentaire-rh" rows="2"
              placeholder="Ex: Approuvé selon planning / Refusé pour raison de service..."
              style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;resize:vertical;box-sizing:border-box;font-size:0.85rem;font-family:inherit;"></textarea>
          </div>
        </div>
      `,
      confirmText: action === "approuve" ? "Approuver" : "Refuser",
      cancelText: "Annuler",
      onConfirm: async (close) => {
        try {
          const token = localStorage.getItem("pamecas_token");
          const res = await fetch(`/api/conges/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ statut: action, commentaire_rh: document.getElementById("commentaire-rh")?.value || "" })
          });
          if (!res.ok) throw new Error((await res.json()).message);
          showToast(`Congé ${action === "approuve" ? "approuvé" : "refusé"}.`, "success");
          close();
          loadConges();
          loadStats();
        } catch (err) {
          showToast(err.message || "Erreur.", "error");
        }
      }
    });
  }

  root.querySelector("#filtre-conge")?.addEventListener("change", loadConges);

  // ── Chargement initial ──────────────────────────────────────────────────────
  await loadTelephone();
  loadStats();
}
