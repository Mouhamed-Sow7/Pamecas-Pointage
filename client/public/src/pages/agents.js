import { get, post, put, del } from "../api.js";
import { cacheAgents } from "../store/indexedDB.js";
import { showModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("pamecas_user"));
  } catch {
    return null;
  }
}

function renderAgentsList(root, agents) {
  const listContainer = root.querySelector("#agents-list");
  if (!listContainer) return;

  if (!agents || agents.length === 0) {
    listContainer.innerHTML =
      '<div style="color:#999; text-align:center; padding:20px 10px;">Aucun agent trouvé.</div>';
    return;
  }

  let html = "";
  agents.forEach((agent) => {
    const statusColor =
      {
        actif: "badge-present",
        inactif: "badge-absent",
        suspendu: "badge-retard",
      }[agent.statut] || "badge-absent";

    html += `
      <div class="card" style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; margin-bottom:4px;">${agent.matricule || agent.numero_employe || "—"}</div>
          <div style="font-size:0.9rem; color:#333; margin-bottom:4px;">${agent.prenom || ""} ${agent.nom || ""}</div>
          <div style="font-size:0.8rem; color:#666; margin-bottom:4px;">
            <div>Type: ${agent.type_contrat || "—"}</div>
            <div>Site: ${agent.site_id?.nom || "—"}</div>
          </div>
          <span class="${statusColor}" style="display:inline-block;">${agent.statut}</span>
        </div>
        <div style="flex:0 0 auto; display:flex; gap:6px;">
          <button class="btn-action" data-id="${agent._id}" data-action="view" style="padding:6px 8px; font-size:0.9rem;"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-action" data-id="${agent._id}" data-action="edit" style="padding:6px 8px; font-size:0.9rem;"><i class="fa-solid fa-pencil"></i></button>
          <button class="btn-action" data-id="${agent._id}" data-action="delete" style="padding:6px 8px; font-size:0.9rem;"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;

  listContainer.querySelectorAll(".btn-action").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const agentId = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      const agent = agents.find((a) => a._id === agentId);

      if (action === "view" || action === "edit") {
        let sites = [];
        try {
          const res = await get("/api/sites");
          sites = res.data || res || [];
        } catch (err) {}
        openAgentModal(action, agent, sites);
      } else if (action === "delete") {
        showModal({
          title: "Supprimer l'agent",
          content:
            '<p style="margin:0;color:#555;">Etes-vous sur de vouloir supprimer cet agent ? Cette action est irreversible.</p>',
          confirmText: "Supprimer",
          cancelText: "Annuler",
          onConfirm: async (close) => {
            try {
              await del(`/api/agents/${agentId}`);
              showToast("Agent supprime.", "success");
              close();
              const root =
                document.getElementById("app").querySelector("main") ||
                document.getElementById("app");
              renderAgents(
                root,
                JSON.parse(localStorage.getItem("pamecas_user")),
              );
            } catch (err) {
              showToast("Erreur suppression.", "error");
            }
          },
        });
      }
    });
  });
}

function renderTable(root, agents) {
  renderAgentsList(root, agents);
}

async function fetchAgents(root, page = 1) {
  const search = root.querySelector("#filter-search").value.trim();
  const agenceId = root.querySelector("#filter-agence")?.value || "";
  const type = root.querySelector("#filter-type").value;
  const statut = root.querySelector("#filter-statut")?.value || "actif";

  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", 100);
  if (search) params.append("search", search);
  if (type) params.append("type_contrat", type);
  if (statut) params.append("statut", statut);
  if (agenceId) params.append("site_id", agenceId);

  try {
    const res = await get(`/api/agents?${params.toString()}`);
    const agents = res.data || [];

    const countEl = root.querySelector("#agents-count");
    if (countEl) countEl.textContent = `${agents.length} agent(s) trouvé(s)`;

    // Trier alphabétiquement pour un affichage plus lisible
    agents.sort((a, b) =>
      `${a.nom}${a.prenom}`.localeCompare(`${b.nom}${b.prenom}`),
    );

    renderTable(root, agents);
    await cacheAgents(agents);
  } catch (err) {
    showToast(
      "Erreur lors du chargement des agents. Affichage du cache si disponible.",
      "warning",
    );
  }
}

function openAgentModal(mode, agent, sites) {
  const isEdit = mode === "edit";
  const isView = mode === "view";

  const siteOptions = (sites || [])
    .map(
      (s) =>
        `<option value="${s._id}" ${
          agent && (agent.site_id?._id === s._id || agent.site_id === s._id)
            ? "selected"
            : ""
        }>${s.nom}</option>`,
    )
    .join("");

  const disabledAttr = isView ? "disabled" : "";
  const showTotpSection = isEdit;
  const matriculeDisplay = agent?.matricule || agent?.numero_employe || "";
  const photoHtml = agent?.photo
    ? `<img id="agent-photo-preview" src="${agent.photo}" style="width:80px;height:80px;border-radius:40px;object-fit:cover;display:block;margin:10px auto;" />`
    : `<div id="agent-photo-preview" style="width:80px;height:80px;border-radius:40px;background:#f0f7f2;color:#0f5132;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;margin:10px auto;">${((agent?.prenom || "?")[0] || "?") + ((agent?.nom || "?")[0] || "?")}</div>`;

  const content = `
    <div style="font-family: 'DM Sans', sans-serif; overflow:hidden; display:flex; flex-direction:column;">
      <div style="padding:8px 14px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:center;gap:6px;">
        <div style="color:#888;font-size:13px;">${matriculeDisplay}</div>
        <div id="modal-page-indicators" style="display:flex;gap:8px;align-items:center;justify-content:center;">
          <span data-idx="0" style="font-size:14px;color:#0f5132;">●</span>
          <span data-idx="1" style="font-size:14px;color:#999;">○</span>
          <span data-idx="2" style="font-size:14px;color:#999;">○</span>
        </div>
      </div>

      <div id="slider-wrapper" style="position:relative;width:100%;min-height:420px;overflow:hidden;">
        <div id="slider-parent" style="position:relative;width:100%;height:100%;overflow:visible;">
          <button id="btn-slide-prev" type="button" style="position:absolute;left:-16px;top:50%;transform:translateY(-50%);z-index:10;border:1.5px solid #0f5132;background:white;color:#0f5132;border-radius:50%;width:32px;height:32px;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.15);">‹</button>
          <button id="btn-slide-next" type="button" style="position:absolute;right:-16px;top:50%;transform:translateY(-50%);z-index:10;border:1.5px solid #0f5132;background:white;color:#0f5132;border-radius:50%;width:32px;height:32px;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.15);">›</button>

          <div id="slider-track" style="display:flex;width:300%;height:100%;transition:transform 0.35s ease-in-out;">
            
            <div id="slide-0" style="width:33.333%;padding:0 16px;box-sizing:border-box;min-height:calc(100% - 56px);">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:12px;">
                <div>
                  <label style="font-size:13px;">Nom</label>
                  <input id="fld-nom" value="${agent?.nom || ""}" ${disabledAttr} style="width:100%; padding:10px; border-radius:12px; border:1.5px solid #ddd;" />
                </div>
                <div>
                  <label style="font-size:13px;">Prénom</label>
                  <input id="fld-prenom" value="${agent?.prenom || ""}" ${disabledAttr} style="width:100%; padding:10px; border-radius:12px; border:1.5px solid #ddd;" />
                </div>
              </div>
              <div style="margin-top:12px;">
                <label style="font-size:13px;">Téléphone</label>
                <input id="fld-telephone" value="${agent?.telephone || ""}" ${disabledAttr} style="width:100%; padding:10px; border-radius:12px; border:1.5px solid #ddd;" />
              </div>
              <div style="margin-top:12px;">
                <label style="font-size:13px;">Site / Agence</label>
                <select id="fld-site_id" ${disabledAttr} style="width:100%; padding:10px; border-radius:12px; border:1.5px solid #ddd;">${siteOptions}</select>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
                <div>
                  <label style="font-size:13px;">Type de contrat</label>
                  <select id="fld-type_contrat" ${disabledAttr} style="width:100%; padding:10px; border-radius:12px; border:1.5px solid #ddd;">
                    <option value="CDI" ${agent?.type_contrat === "CDI" ? "selected" : ""}>CDI</option>
                    <option value="CDD" ${agent?.type_contrat === "CDD" ? "selected" : ""}>CDD</option>
                    <option value="stage" ${agent?.type_contrat === "stage" ? "selected" : ""}>Stage</option>
                    <option value="prestataire" ${agent?.type_contrat === "prestataire" ? "selected" : ""}>Prestataire</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:13px;">Statut</label>
                  <select id="fld-statut" ${disabledAttr} style="width:100%; padding:10px; border-radius:12px; border:1.5px solid #ddd;">
                    <option value="actif" ${!agent || agent.statut === "actif" ? "selected" : ""}>Actif</option>
                    <option value="inactif" ${agent?.statut === "inactif" ? "selected" : ""}>Inactif</option>
                    <option value="suspendu" ${agent?.statut === "suspendu" ? "selected" : ""}>Suspendu</option>
                  </select>
                </div>
              </div>
              <div style="margin-top:12px;">
                <label style="font-size:13px;">Poste</label>
                <input id="fld-poste" value="${agent?.poste || ""}" ${disabledAttr} style="width:100%; padding:10px; border-radius:12px; border:1.5px solid #ddd;" />
              </div>
            </div>

            
            <div id="slide-1" style="width:33.333%;padding:0 16px;box-sizing:border-box;min-height:calc(100% - 56px);display:flex;flex-direction:column;align-items:center;">
              ${photoHtml}
              <div style="text-align:center;margin-top:8px;">
                <input id="agent-photo-input" type="file" accept="image/*" ${disabledAttr} style="display:block;margin:6px auto;" />
              </div>

              ${
                showTotpSection
                  ? `
              <div style="background:#f7fff7;border-radius:10px;padding:12px;margin-top:12px;width:100%;box-sizing:border-box;">
                <div style="font-size:0.9rem;font-weight:600;color:#0f5132;margin-bottom:8px;">Portail Agent</div>
                <div style="margin-bottom:8px;">
                  <label style="font-size:13px;">Mot de passe portail</label>
                  <input id="agent-portal-pwd" type="password" placeholder="Définir ou changer le mot de passe" ${disabledAttr} style="width:100%;padding:10px;border:1.5px solid #ddd;border-radius:8px;" />
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                  <span id="totp-indicator" style="font-size:13px;color:${agent.totp_enabled ? "#2e7d32" : "#888"};">${agent.totp_enabled ? "🔄 QR Dynamique activé" : "⚠️ QR Statique"}</span>
                  ${!agent.totp_enabled ? `<button id="btn-activer-totp" type="button" style="padding:6px 12px;background:#0f5132;color:white;border:none;border-radius:8px;cursor:pointer;">Activer QR Dynamique</button>` : ""}
                </div>
              </div>
              `
                  : ""
              }
            </div>

            
            <div id="slide-2" style="width:33.333%;padding:0 16px;box-sizing:border-box;min-height:calc(100% - 56px);display:flex;flex-direction:column;align-items:center;justify-content:center;">
              <div id="qr-container-large" style="width:150px;height:150px;background:white;display:flex;align-items:center;justify-content:center;border-radius:12px;margin:8px auto;">
                <img id="agent-qr-img" alt="QR" style="max-width:100%;max-height:100%;" />
              </div>
              <div id="modal-agent-matricule" style="margin-top:12px;color:#666;">${matriculeDisplay}</div>
              <button id="btn-download-qr" type="button" style="margin-top:12px;padding:8px 14px;border-radius:8px;border:1px solid #0f5132;background:transparent;color:#0f5132;">Télécharger le QR</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    `;

  const title =
    mode === "create"
      ? "Ajouter un agent"
      : mode === "edit"
        ? "Modifier un agent"
        : "Détail agent";

  // Show modal and wire interactions via onReady / onConfirm
  showModal({
    title,
    content,
    confirmText: isView ? "Fermer" : "Enregistrer",
    cancelText: "Annuler",
    onReady: (close) => {
      let current = 0;
      const slides = document.getElementById("slider-track");
      const prev = document.getElementById("btn-slide-prev");
      const next = document.getElementById("btn-slide-next");
      const indicators = document.getElementById("modal-page-indicators");

      function update() {
        if (!slides) return;
        slides.style.transform = `translateX(-${current * 33.333}%)`;
        Array.from(indicators.querySelectorAll("span")).forEach((s, i) => {
          s.style.color = i === current ? "#0f5132" : "#999";
          s.textContent = i === current ? "●" : "○";
        });
      }

      prev.addEventListener("click", () => {
        current = Math.max(0, current - 1);
        update();
      });
      next.addEventListener("click", () => {
        current = Math.min(2, current + 1);
        update();
      });

      // File preview
      const fileIn = document.getElementById("agent-photo-input");
      const preview = document.getElementById("agent-photo-preview");
      if (fileIn) {
        fileIn.addEventListener("change", (e) => {
          const f = e.target.files[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = () => {
            if (preview)
              preview.outerHTML = `<img id="agent-photo-preview" src="${r.result}" style="width:160px;height:160px;border-radius:80px;object-fit:cover;display:block;margin:12px auto;" />`;
          };
          r.readAsDataURL(f);
        });
      }

      // TOTP activation
      const btnTotp = document.getElementById("btn-activer-totp");
      if (btnTotp) {
        btnTotp.addEventListener("click", async () => {
          try {
            await post(`/api/agents/${agent._id}/totp/activate`, {});
            showToast("QR dynamique activé.", "success");
            close();
            const root =
              document.getElementById("app").querySelector("main") ||
              document.getElementById("app");
            renderAgents(
              root,
              JSON.parse(localStorage.getItem("pamecas_user")),
            );
          } catch (err) {
            showToast("Erreur activation TOTP.", "error");
          }
        });
      }

      // Load QR image if agent exists
      if (agent && agent._id) {
        const qrImg = document.getElementById("agent-qr-img");
        if (qrImg) {
          get(`/api/agents/${agent._id}/qr`)
            .then((res) => {
              qrImg.src = `data:image/png;base64,${res.qr_base64}`;
            })
            .catch(() => {});
        }
      }

      // Download QR
      const btnDownload = document.getElementById("btn-download-qr");
      if (btnDownload) {
        btnDownload.addEventListener("click", () => {
          const qr = document.getElementById("agent-qr-img");
          if (!qr || !qr.src) return showToast("QR non disponible", "error");
          const a = document.createElement("a");
          a.href = qr.src;
          a.download = `${matriculeDisplay || "qr"}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        });
      }

      // Initialize
      update();
    },
    onConfirm: async (close) => {
      if (isView) {
        close();
        return;
      }

      const payload = {
        nom: document.getElementById("fld-nom")?.value || "",
        prenom: document.getElementById("fld-prenom")?.value || "",
        telephone: document.getElementById("fld-telephone")?.value || "",
        site_id: document.getElementById("fld-site_id")?.value || "",
        type_contrat: document.getElementById("fld-type_contrat")?.value || "",
        statut: document.getElementById("fld-statut")?.value || "",
        poste: document.getElementById("fld-poste")?.value || "",
      };

      const portalPwd = document.getElementById("agent-portal-pwd")?.value;
      if (portalPwd) payload.portal_password = portalPwd;

      const fileInput = document.getElementById("agent-photo-input");
      const file = fileInput?.files && fileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          payload.photo = reader.result;
          await save(payload, close);
        };
        reader.readAsDataURL(file);
      } else {
        await save(payload, close);
      }

      async function save(data, closeModal) {
        try {
          if (mode === "create") {
            await post("/api/agents", data);
            showToast("Agent crée avec succés.", "success");
          } else if (mode === "edit") {
            await put(`/api/agents/${agent._id}`, data);
            showToast("Agent mis à jour avec succés.", "success");
          }
          closeModal();
          const root =
            document.getElementById("app").querySelector("main") ||
            document.getElementById("app");
          renderAgents(root, JSON.parse(localStorage.getItem("pamecas_user")));
        } catch (err) {
          showToast(
            "Erreur lors de l'enregistrement de l'agent. Vérifiez les données.",
            "error",
          );
        }
      }
    },
  });
}

async function openImportModal(root) {
  let sites = [];
  try {
    const res = await get("/api/sites");
    sites = res.data || res || [];
  } catch {}

  const user = getCurrentUser();
  const defaultSiteId = user?.site_id || "";

  const siteOptions = sites
    .map(
      (s) =>
        `<option value="${s._id}" ${s._id === defaultSiteId ? "selected" : ""}>${s.nom}</option>`,
    )
    .join("");

  showModal({
    title: "Importer agents depuis CSV",
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
    confirmText: "Importer",
    cancelText: "Annuler",
    onConfirm: async (close) => {
      const file = document.getElementById("import-file")?.files[0];
      const siteId = document.getElementById("import-site-id")?.value;
      const resultDiv = document.getElementById("import-result");

      if (!siteId) {
        showToast("Selectionnez une agence.", "warning");
        return;
      }
      if (!file) {
        showToast("Selectionnez un fichier CSV.", "warning");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("site_id", siteId);

      try {
        const token = localStorage.getItem("pamecas_token");
        const res = await fetch("/api/agents/import-csv", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();

        if (res.ok) {
          if (resultDiv) {
            resultDiv.style.display = "block";
            resultDiv.style.background = "#e8f5e9";
            resultDiv.style.color = "#2e7d32";
            resultDiv.innerHTML = `
              <i class="fa-solid fa-circle-check"></i> ${data.message}
              ${data.errors?.length > 0 ? "<br><small>" + data.errors.join("<br>") + "</small>" : ""}
            `;
          }
          showToast(data.message, "success");
          setTimeout(() => {
            close();
            window.location.hash = "#/agents";
          }, 1500);
        } else {
          showToast(data.message || "Erreur import.", "error");
        }
      } catch (err) {
        showToast("Erreur reseau: " + err.message, "error");
      }
    },
  });
}

export async function renderAgents(root, user) {
  const canEdit = user && (user.role === "admin" || user.role === "superadmin");

  root.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <h2 style="font-size:1.1rem;font-weight:700;">
            <i class="fa-solid fa-users" style="color:#2e7d32;margin-right:6px;"></i>Agents
          </h2>
          ${
            canEdit
              ? `
          <div style="display:flex;gap:8px;">
            <button id="btn-import-csv" class="btn-primary" style="background:linear-gradient(135deg,#1565c0,#1976d2);font-size:0.78rem;padding:6px 10px;">
              <i class="fa-solid fa-file-csv"></i> Importer CSV
            </button>
            <button id="btn-qr-sheet" class="btn-primary" style="background:linear-gradient(135deg,#6a1b9a,#8e24aa);font-size:0.78rem;padding:6px 10px;">
              <i class="fa-solid fa-id-card"></i> QR Cards
            </button>
          </div>`
              : ""
          }
        </div>

        
        <div style="background:white;border-radius:10px;padding:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);border:1px solid #eee;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;">
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:#666;display:block;margin-bottom:4px;">
                <i class="fa-solid fa-magnifying-glass" style="color:#2e7d32;"></i> Recherche
              </label>
              <input id="filter-search" placeholder="Nom, prénom ou matricule..."
                style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;box-sizing:border-box;" />
            </div>

            <div id="filter-agence-wrap">
              <label style="font-size:0.75rem;font-weight:600;color:#666;display:block;margin-bottom:4px;">
                <i class="fa-solid fa-building" style="color:#2e7d32;"></i> Agence
              </label>
              <select id="filter-agence"
                style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
                <option value="">Toutes les agences</option>
              </select>
            </div>

            <div>
              <label style="font-size:0.75rem;font-weight:600;color:#666;display:block;margin-bottom:4px;">
                <i class="fa-solid fa-file-contract" style="color:#2e7d32;"></i> Type contrat
              </label>
              <select id="filter-type" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
                <option value="">Tous types</option>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="stage">Stage</option>
                <option value="prestataire">Prestataire</option>
              </select>
            </div>

            <div>
              <label style="font-size:0.75rem;font-weight:600;color:#666;display:block;margin-bottom:4px;">
                <i class="fa-solid fa-circle-half-stroke" style="color:#2e7d32;"></i> Statut
              </label>
              <select id="filter-statut"
                style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
                <option value="actif">Actifs</option>
                <option value="">Tous</option>
                <option value="inactif">Inactifs</option>
                <option value="suspendu">Suspendus</option>
              </select>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
            <span id="agents-count" style="font-size:0.8rem;color:#888;">Chargement...</span>
            <button id="btn-filter" class="btn-primary" style="padding:8px 16px;font-size:0.82rem;">
              <i class="fa-solid fa-filter"></i> Filtrer
            </button>
          </div>
        </div>
      </div>

      <div id="agents-list" style="display:flex; flex-direction:column; gap:10px;">
        <div style="color:#999; text-align:center; padding:20px 10px;">Chargement...</div>
      </div>
    </div>
    ${canEdit ? `<button id="btn-add-agent" class="fab">+</button>` : ""}
  `;

  // Filtre agence (superadmin seulement)
  const filterAgenceWrap = root.querySelector("#filter-agence-wrap");
  const filterAgence = root.querySelector("#filter-agence");
  if (user?.role === "superadmin") {
    try {
      const res = await get("/api/sites");
      const sites = res.data || res || [];
      sites.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s._id;
        opt.textContent = s.nom;
        filterAgence.appendChild(opt);
      });
    } catch {}
  } else {
    if (filterAgenceWrap) filterAgenceWrap.style.display = "none";
  }

  // Filtres en temps réel
  root
    .querySelector("#filter-search")
    ?.addEventListener("input", () => fetchAgents(root, 1));
  root
    .querySelector("#filter-agence")
    ?.addEventListener("change", () => fetchAgents(root, 1));
  root
    .querySelector("#filter-type")
    ?.addEventListener("change", () => fetchAgents(root, 1));
  root
    .querySelector("#filter-statut")
    ?.addEventListener("change", () => fetchAgents(root, 1));
  root
    .querySelector("#btn-filter")
    ?.addEventListener("click", () => fetchAgents(root, 1));

  if (canEdit) {
    const addBtn = root.querySelector("#btn-add-agent");
    addBtn.addEventListener("click", async () => {
      let sites = [];
      try {
        const res = await get("/api/sites");
        sites = res.data || res || [];
      } catch (err) {}
      openAgentModal("create", null, sites);
    });

    const btnImportCsv = root.querySelector("#btn-import-csv");
    btnImportCsv.addEventListener("click", () => openImportModal(root));

    const btnQrSheet = root.querySelector("#btn-qr-sheet");
    btnQrSheet.addEventListener("click", async () => {
      const currentUser = getCurrentUser();
      const token = localStorage.getItem("pamecas_token");

      if (currentUser?.site_id) {
        window.open(
          `/api/agents/qr-sheet/${currentUser.site_id}?token=${token}`,
          "_blank",
        );
        return;
      }

      // Superadmin — demander quelle agence
      let sites = [];
      try {
        const res = await get("/api/sites");
        sites = res.data || res || [];
      } catch {}

      const siteOptions = sites
        .map((s) => `<option value="${s._id}">${s.nom}</option>`)
        .join("");

      showModal({
        title: "QR Cards — Choisir une agence",
        content: `
          <div>
            <label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:8px;">Agence</label>
            <select id="qr-site-select" style="width:100%;padding:10px;border:1.5px solid #ddd;border-radius:8px;">
              <option value="">-- Selectionner --</option>
              ${siteOptions}
            </select>
          </div>
        `,
        confirmText: "Generer QR Cards",
        cancelText: "Annuler",
        onConfirm: (close) => {
          const siteId = document.getElementById("qr-site-select")?.value;
          if (!siteId) {
            showToast("Selectionnez une agence.", "warning");
            return;
          }
          close();
          window.open(
            `/api/agents/qr-sheet/${siteId}?token=${token}`,
            "_blank",
          );
        },
      });
    });
  }

  fetchAgents(root, 1);
}
