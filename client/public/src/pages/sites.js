import { get, post, put } from "../api.js";
import { showModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

const REGIONS_SENEGAL = [
  "Dakar",
  "Diourbel",
  "Fatick",
  "Kaffrine",
  "Kaolack",
  "Kedougou",
  "Kolda",
  "Louga",
  "Matam",
  "Saint-Louis",
  "Sedhiou",
  "Tambacounda",
  "Thies",
  "Ziguinchor",
];

// ─── Rendu du tableau ────────────────────────────────────────────
function renderTable(root, sites) {
  const tbody = root.querySelector("#sites-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!sites.length) {
    tbody.innerHTML = `
        <tr><td colspan="7" style="text-align:center;padding:24px;color:#aaa;">
          <i class="fa-solid fa-building-circle-xmark"></i> Aucun site trouve
        </td></tr>
      `;
    return;
  }

  sites.forEach((site) => {
    const tr = document.createElement("tr");
    tr.dataset.id = site._id;
    tr.style.transition = "background 0.2s";

    tr.innerHTML = `
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1565c0;">${site.code}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${site.nom}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">${site.region || ""}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">${site.responsable || "—"}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <span class="statut-badge ${site.actif ? "badge-present" : "badge-absent"}" style="font-size:0.75rem;padding:3px 10px;border-radius:12px;">
            ${site.actif ? "Actif" : "Inactif"}
          </span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn-action btn-edit-site" data-id="${site._id}"
              style="width:32px;height:32px;border-radius:8px;border:1.5px solid #1565c0;background:white;color:#1565c0;cursor:pointer;font-size:0.75rem;"
              title="Modifier">
              <i class="fa-solid fa-pencil"></i>
            </button>
            <button class="btn-action btn-toggle-site" data-id="${site._id}" data-actif="${site.actif}"
              style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;border:1.5px solid ${site.actif ? "#c62828" : "var(--green)"};background:white;color:${site.actif ? "#c62828" : "var(--green)"};cursor:pointer;font-size:0.78rem;font-weight:500;"
              title="${site.actif ? "Desactiver" : "Activer"}">
              <i class="fa-solid ${site.actif ? "fa-toggle-on" : "fa-toggle-off"}" style="font-size:1rem;"></i>
              ${site.actif ? "Desactiver" : "Activer"}
            </button>
          </div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          ${
            site.kiosque_url
              ? `
            <button class="btn-copy-kiosque"
              data-url="${site.kiosque_url}"
              data-nom="${site.nom}"
              style="display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;border:1.5px solid var(--green);background:white;color:var(--green);cursor:pointer;font-size:0.75rem;font-weight:500;"
              title="${site.kiosque_url}">
              <i class="fa-solid fa-tablet-screen-button"></i> Copier URL
            </button>
            ${
              site.kiosque_token
                ? `
              <button class="btn-deploy-kiosque"
                data-token="${site.kiosque_token}"
                data-nom="${site.nom}"
                data-site="${site._id}"
                style="display:flex;align-items:center;gap:5px;padding:5px 10px;margin-top:6px;border-radius:8px;border:none;background:linear-gradient(135deg,var(--green-dark),var(--green));color:white;cursor:pointer;font-size:0.75rem;font-weight:600;width:100%;">
                <i class="fa-solid fa-tablet-screen-button"></i> Deployer kiosque
              </button>
            `
                : ""
            }
          `
              : `
            <button class="btn-gen-kiosque" data-id="${site._id}"
              style="padding:5px 10px;border-radius:8px;border:1.5px solid #aaa;background:white;color:#aaa;cursor:pointer;font-size:0.75rem;">
              Générer
            </button>
          `
          }
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;min-width:160px;" class="pin-col">
          ${(() => {
            const pin = site.kiosque_pin;
            const expires = site.kiosque_pin_expires_at ? new Date(site.kiosque_pin_expires_at) : null;
            const now = new Date();
            const isExpired = expires && expires < now;
            const expiresIn = expires && !isExpired ? Math.max(0, Math.round((expires - now) / 60000)) : null;
            if (pin && !isExpired) {
              const h = expiresIn !== null ? Math.floor(expiresIn/60) : null;
              const m = expiresIn !== null ? expiresIn % 60 : null;
              const expiresStr = expiresIn !== null ? (h > 0 ? h+"h"+(m>0?m+"m":"") : m+"min") : "";
              return `<div style="display:flex;align-items:center;gap:6px;">
                <span style="font-family:'DM Mono',monospace;font-size:1rem;font-weight:700;letter-spacing:0.15em;color:#0f5132;background:#e8f5e9;padding:4px 10px;border-radius:8px;">${pin}</span>
                <button class="btn-rotate-pin" data-id="${site._id}" title="Regénérer PIN" style="background:none;border:none;cursor:pointer;padding:4px;color:#0f5132;"><i class=\"fa-solid fa-rotate-right\"></i></button>
              </div>${expiresIn !== null ? "<div style=\"font-size:11px;color:"+(expiresIn<60?"#c62828":"#888")+";margin-top:3px;\"><i class=\"fa-regular fa-clock\"></i> Expire dans "+expiresStr+"</div>" : ""}`;
            }
            return `<button class="btn-rotate-pin" data-id="${site._id}"
              style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;border:1.5px solid #0f5132;background:white;color:#0f5132;cursor:pointer;font-size:0.75rem;font-weight:500;">
              <i class="fa-solid fa-key"></i> Générer PIN
            </button>`;
          })()}
        </td>
      `;
    tbody.appendChild(tr);
  });
}

// ─── Charger les sites ───────────────────────────────────────────
let sitesCache = [];

async function fetchSites(root) {
  try {
    const res = await get("/api/sites");
    sitesCache = res.data || res || [];
    renderTable(root, sitesCache);
  } catch {
    showToast("Erreur lors du chargement des sites.", "error");
  }
}

// ─── Modal ajout/modification ────────────────────────────────────
function openSiteModal(mode, site, root) {
  const isEdit = mode === "edit";

  const regionOptions = REGIONS_SENEGAL.map(
    (r) =>
      `<option value="${r}" ${site?.region === r ? "selected" : ""}>${r}</option>`,
  ).join("");

  const content = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:4px;">Code</label>
            <input id="f-code" value="${site?.code || ""}" ${isEdit ? 'disabled style="background:#f5f5f5;"' : ""}
              placeholder="PAM-XXX"
              style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:4px;">Region</label>
            <select id="f-region" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;">
              ${regionOptions}
            </select>
          </div>
        </div>
        <div>
          <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:4px;">Nom</label>
          <input id="f-nom" value="${site?.nom || ""}" placeholder="Nom de l'agence"
            style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:4px;">Responsable</label>
            <input id="f-responsable" value="${site?.responsable || ""}" placeholder="Nom du responsable"
              style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-size:0.82rem;font-weight:600;display:block;margin-bottom:4px;">Telephone</label>
            <input id="f-telephone" value="${site?.telephone || ""}" placeholder="77 XXX XX XX"
              style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;" />
          </div>
        </div>
        <div style="background:#f8f9fa;border-radius:10px;padding:12px;">
          <div style="font-size:0.82rem;font-weight:600;margin-bottom:10px;color:#444;">
            <i class="fa-solid fa-clock" style="color:var(--green);"></i> Horaires de travail
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:0.78rem;font-weight:500;display:block;margin-bottom:6px;color:#666;">
                <i class="fa-regular fa-clock" style="color:var(--green);"></i> Heure debut
              </label>
              <input id="f-heure-debut" type="time" value="${site?.config?.heure_debut || "08:00"}"
                style="width:100%;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:1rem;background:white;color:#1f2933;font-family:inherit;" />
            </div>
            <div>
              <label style="font-size:0.78rem;font-weight:500;display:block;margin-bottom:6px;color:#666;">
                <i class="fa-solid fa-triangle-exclamation" style="color:#e65100;"></i> Seuil retard
              </label>
              <input id="f-heure-retard" type="time" value="${site?.config?.heure_retard || "08:15"}"
                style="width:100%;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:1rem;background:white;color:#1f2933;font-family:inherit;" />
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.82rem;">
            <input id="f-weekend" type="checkbox" ${site?.config?.weekend_actif ? "checked" : ""} style="accent-color:var(--green);width:16px;height:16px;">
            Weekend actif
          </label>
        </div>
      </div>
    `;

  showModal({
    title: isEdit ? "Modifier l'agence" : "Ajouter une agence",
    content,
    confirmText: "Enregistrer",
    cancelText: "Annuler",
    onConfirm: async (close) => {
      const payload = {
        code: document.getElementById("f-code")?.value?.trim(),
        nom: document.getElementById("f-nom")?.value?.trim(),
        region: document.getElementById("f-region")?.value,
        responsable: document.getElementById("f-responsable")?.value?.trim(),
        telephone: document.getElementById("f-telephone")?.value?.trim(),
        config: {
          heure_debut: document.getElementById("f-heure-debut")?.value,
          heure_retard: document.getElementById("f-heure-retard")?.value,
          weekend_actif: document.getElementById("f-weekend")?.checked,
        },
      };

      if (!payload.nom) {
        showToast("Le nom est obligatoire.", "warning");
        return;
      }
      if (!isEdit && !payload.code) {
        showToast("Le code est obligatoire.", "warning");
        return;
      }

      try {
        if (isEdit && site?._id) {
          await put(`/api/sites/${site._id}`, payload);
          showToast("Agence mise a jour.", "success");
        } else {
          await post("/api/sites", payload);
          showToast("Agence creee.", "success");
        }
        close();
        fetchSites(root);
      } catch (err) {
        showToast(err.message || "Erreur lors de l'enregistrement.", "error");
      }
    },
  });
}

// ─── Export principal ────────────────────────────────────────────
export async function renderSites(root, user) {
  const canEdit = user && user.role === "superadmin";

  root.innerHTML = `
      <div class="card" style="display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="font-size:1.1rem;font-weight:700;">
            <i class="fa-solid fa-building" style="color:var(--green);margin-right:6px;"></i>Agences
          </h2>
          ${
            canEdit
              ? `
          <button id="btn-add-site" class="btn-primary" style="display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-plus"></i> Ajouter
          </button>`
              : ""
          }
        </div>

        <!-- Tableau scrollable interne -->
        <div style="overflow-x:auto;border-radius:10px;border:1px solid #eee;">
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem;min-width:600px;">
            <thead>
              <tr style="background:linear-gradient(135deg,var(--green),var(--green-light));color:white;">
                <th style="padding:12px;text-align:left;font-weight:600;">Code</th>
                <th style="padding:12px;text-align:left;font-weight:600;">Nom</th>
                <th style="padding:12px;text-align:left;font-weight:600;">Region</th>
                <th style="padding:12px;text-align:left;font-weight:600;">Responsable</th>
                <th style="padding:12px;text-align:left;font-weight:600;">Statut</th>
                ${canEdit ? '<th style="padding:12px;text-align:left;font-weight:600;">Actions</th><th style="padding:12px;text-align:left;font-weight:600;">Kiosque</th><th style=\"padding:12px;text-align:left;font-weight:600;\">PIN kiosque</th>' : ""}
              </tr>
            </thead>
            <tbody id="sites-tbody">
              <tr><td colspan="7" style="text-align:center;padding:24px;color:#aaa;">
                <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

  if (canEdit) {
    root
      .querySelector("#btn-add-site")
      .addEventListener("click", () => openSiteModal("create", null, root));
  }

  // Event delegation sur tbody
  const tbody = root.querySelector("#sites-tbody");
  tbody.addEventListener("click", async (e) => {
    const btnCopy = e.target.closest(".btn-copy-kiosque");
    const btnGen = e.target.closest(".btn-gen-kiosque");
    const btnEdit = e.target.closest(".btn-edit-site");
    const btnToggle = e.target.closest(".btn-toggle-site");
    const btnDeploy = e.target.closest(".btn-deploy-kiosque");
    const btnRotatePin = e.target.closest(".btn-rotate-pin");

    if (btnRotatePin) {
      const siteId = btnRotatePin.dataset.id;
      const site = sitesCache.find((s) => s._id === siteId);
      const nom = site?.nom || "ce site";
      try {
        const token = localStorage.getItem("pamecas_token");
        btnRotatePin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnRotatePin.disabled = true;
        const res = await fetch(`/api/sites/${siteId}/rotate-pin`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        showToast(`PIN kiosque ${nom} : ${data.site.kiosque_pin} (valide 8h)`, "success");
        fetchSites(root);
      } catch {
        showToast("Erreur génération PIN.", "error");
        btnRotatePin.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
        btnRotatePin.disabled = false;
      }
      return;
    }

    if (btnCopy) {
      await navigator.clipboard.writeText(btnCopy.dataset.url);
      showToast(`URL kiosque ${btnCopy.dataset.nom} copiée !`, "success");
      return;
    }

    if (btnGen) {
      try {
        const token = localStorage.getItem("pamecas_token");
        const res = await fetch(
          `/api/sites/${btnGen.dataset.id}/kiosque-token`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error();
        showToast("URL kiosque générée !", "success");
        fetchSites(root);
      } catch {
        showToast("Erreur génération.", "error");
      }
      return;
    }

    if (btnEdit) {
      const id = btnEdit.dataset.id;
      const site = sitesCache.find((s) => s._id === id);
      if (site) openSiteModal("edit", site, root);
      return;
    }

    if (btnToggle) {
      const id = btnToggle.dataset.id;
      const estActif = btnToggle.dataset.actif === "true";
      const site = sitesCache.find((s) => s._id === id);
      if (!site) return;

      const action = estActif ? "desactiver" : "activer";

      showModal({
        title: `Confirmer`,
        content: `<p style="margin:0;">Voulez-vous <strong>${action}</strong> l'agence <strong>${site.nom}</strong> ?</p>`,
        confirmText: estActif ? "Desactiver" : "Activer",
        cancelText: "Annuler",
        onConfirm: async (close) => {
          try {
            await put(`/api/sites/${id}`, { actif: !estActif });
            showToast(
              `Agence ${estActif ? "desactivee" : "activee"}.`,
              "success",
            );
            close();
            fetchSites(root); // recharge la liste sans disparition
          } catch {
            showToast("Erreur lors du changement de statut.", "error");
          }
        },
      });
      return;
    }

    if (btnDeploy) {
      const siteId = btnDeploy.dataset.site;
      const site = sitesCache.find((s) => s._id === siteId);
      if (!site?.kiosque_url) {
        showToast("Token kiosque manquant — clique d'abord sur 'Générer' pour ce site.", "error");
        return;
      }
      // Utilise l'URL kiosque déjà générée côté serveur (#/kiosque?ktoken=...)
      // Le format /kiosk?site=... n'est pas compatible avec renderKiosque() qui lit le hash
      window.open(site.kiosque_url, "_blank");
      return;
    }
  });

  fetchSites(root);
}
