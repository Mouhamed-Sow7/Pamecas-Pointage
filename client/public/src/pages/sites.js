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
      openGeofenceModal(site, root);
      return;
    }
  });

  fetchSites(root);
}

// ─── Modal de confirmation geofencing avant déploiement kiosk ────────────────
function openGeofenceModal(site, root) {
  const existing = site.coordonnees?.latitude && site.coordonnees?.longitude ? site.coordonnees : null;

  const content = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <p style="margin:0;color:#555;font-size:0.88rem;">
        Le kiosque de <strong>${site.nom}</strong> ne pourra valider les pointages que dans un rayon de <strong>500 m</strong>
        autour de la position confirmée ci-dessous.
      </p>

      <div id="geo-status" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f5f5f5;border-radius:8px;font-size:0.85rem;color:#666;">
        <i class="fa-solid fa-spinner fa-spin"></i> Localisation en cours...
      </div>

      <div id="geo-map-outer" style="display:none;">
        <div style="display:flex;justify-content:center;gap:6px;margin-bottom:6px;">
          <button id="geo-zoom-out" type="button" class="btn-icon-sm" style="width:28px;height:28px;border-radius:6px;border:1px solid #ddd;background:white;cursor:pointer;">−</button>
          <span style="font-size:0.72rem;color:#999;align-self:center;">zoom</span>
          <button id="geo-zoom-in" type="button" class="btn-icon-sm" style="width:28px;height:28px;border-radius:6px;border:1px solid #ddd;background:white;cursor:pointer;">+</button>
        </div>
        <div id="geo-map-wrap" style="border-radius:10px;overflow:hidden;border:1px solid #eee;position:relative;width:288px;height:288px;margin:0 auto;background:#eee;cursor:crosshair;">
          <div id="geo-map-mosaic" style="position:absolute;width:768px;height:768px;"></div>
          <div id="geo-map-pin" style="position:absolute;width:14px;height:14px;border-radius:50%;background:#c62828;border:2px solid white;box-shadow:0 0 0 2px rgba(198,40,40,0.4);transform:translate(-50%,-50%);pointer-events:none;"></div>
        </div>
        <div style="font-size:0.72rem;color:#999;text-align:center;margin-top:4px;">Clique n'importe où sur la carte pour déplacer le point.</div>
      </div>
      <div id="geo-manual" style="display:none;font-size:0.78rem;color:#888;text-align:center;">
        Ou saisis/colle les coordonnées exactes (décimal, "16°01'21.0"N", ou une paire "lat, lng") :
      </div>
      <div id="geo-manual-fields" style="display:none;gap:8px;align-items:center;">
        <input id="geo-lat-input" type="text" inputmode="decimal" placeholder="Latitude" style="flex:1;padding:8px;border:1.5px solid #ddd;border-radius:8px;font-size:0.82rem;">
        <input id="geo-lng-input" type="text" inputmode="decimal" placeholder="Longitude" style="flex:1;padding:8px;border:1.5px solid #ddd;border-radius:8px;font-size:0.82rem;">
        <button id="geo-apply-manual" type="button" style="padding:8px 12px;font-size:0.78rem;white-space:nowrap;background:#0f5132;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Valider</button>
      </div>

      ${existing ? `
        <div style="font-size:0.78rem;color:#888;background:#fff8f5;border-radius:8px;padding:8px 10px;">
          <i class="fa-solid fa-circle-info"></i> Ce site a déjà une position enregistrée
          (${existing.latitude.toFixed(5)}, ${existing.longitude.toFixed(5)}).
          Confirmer ci-dessous la remplacera par ta position actuelle.
          <button id="btn-clear-geo" type="button" style="margin-left:6px;background:none;border:none;color:#c62828;text-decoration:underline;cursor:pointer;font-size:0.78rem;padding:0;">
            Retirer le geofencing de ce site
          </button>
        </div>
      ` : ""}
    </div>
  `;

  showModal({
    title: "Confirmer la zone de pointage",
    content,
    confirmText: "Confirmer et déployer",
    cancelText: "Annuler",
    onConfirm: async (close) => {
      const lat = document.getElementById("geo-map-wrap")?.dataset.lat;
      const lng = document.getElementById("geo-map-wrap")?.dataset.lng;
      if (!lat || !lng) {
        showToast("Position non disponible — réessaie ou vérifie l'autorisation de localisation.", "error");
        return;
      }
      try {
        await put(`/api/sites/${site._id}/coordonnees`, { latitude: parseFloat(lat), longitude: parseFloat(lng) });
        showToast("Zone de pointage confirmée.", "success");
        close();
        window.open(site.kiosque_url, "_blank");
        fetchSites(root);
      } catch {
        showToast("Erreur lors de l'enregistrement de la position.", "error");
      }
    },
  });

  const statusEl = document.getElementById("geo-status");
  const mapOuter = document.getElementById("geo-map-outer");
  const mapWrap = document.getElementById("geo-map-wrap");
  const mosaic = document.getElementById("geo-map-mosaic");
  const mapPin = document.getElementById("geo-map-pin");
  const manualHint = document.getElementById("geo-manual");
  const manualFields = document.getElementById("geo-manual-fields");
  const latInput = document.getElementById("geo-lat-input");
  const lngInput = document.getElementById("geo-lng-input");

  let ZOOM = 16;
  let curLat = null, curLng = null;
  // Coin haut-gauche de la mosaïque 3x3 (en coordonnées de tuile, non arrondies)
  let originXTile = null, originYTile = null;

  function lngLatToTileF(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const latRad = (lat * Math.PI) / 180;
    return {
      xTileF: ((lng + 180) / 360) * n,
      yTileF: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
    };
  }
  function tileFToLatLng(xTileF, yTileF, zoom) {
    const n = Math.pow(2, zoom);
    const lng = (xTileF / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * yTileF) / n)));
    return { lat: (latRad * 180) / Math.PI, lng };
  }

  function renderMosaic() {
    const { xTileF, yTileF } = lngLatToTileF(curLat, curLng, ZOOM);
    const centerXTile = Math.floor(xTileF);
    const centerYTile = Math.floor(yTileF);
    originXTile = centerXTile - 1;
    originYTile = centerYTile - 1;

    mosaic.innerHTML = "";
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const img = document.createElement("img");
        img.width = 256; img.height = 256;
        img.style.cssText = `position:absolute;left:${dx * 256}px;top:${dy * 256}px;pointer-events:none;`;
        img.src = `https://tile.openstreetmap.org/${ZOOM}/${originXTile + dx}/${originYTile + dy}.png`;
        mosaic.appendChild(img);
      }
    }
    // Centrer visuellement la mosaïque 768px dans la fenêtre 288px, point sous le curseur
    const pinPxX = (xTileF - originXTile) * 256;
    const pinPxY = (yTileF - originYTile) * 256;
    mosaic.style.left = `${144 - pinPxX}px`;
    mosaic.style.top = `${144 - pinPxY}px`;
    mapPin.style.left = "144px";
    mapPin.style.top = "144px";
  }

  function showPosition(lat, lng, label) {
    curLat = lat; curLng = lng;
    mapWrap.dataset.lat = lat;
    mapWrap.dataset.lng = lng;
    mapOuter.style.display = "block";
    manualHint.style.display = "block";
    manualFields.style.display = "flex";
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    statusEl.innerHTML = `<i class="fa-solid fa-location-crosshairs" style="color:#0f5132;"></i> ${label} : ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    renderMosaic();
  }

  mapWrap.addEventListener("click", (e) => {
    if (originXTile === null) return;
    const rect = mapWrap.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // px/py sont dans le cadre visible (288); on retrouve la position dans la mosaïque via son offset courant
    const mosaicLeft = parseFloat(mosaic.style.left);
    const mosaicTop = parseFloat(mosaic.style.top);
    const xTileF = originXTile + (px - mosaicLeft) / 256;
    const yTileF = originYTile + (py - mosaicTop) / 256;
    const { lat, lng } = tileFToLatLng(xTileF, yTileF, ZOOM);
    showPosition(lat, lng, "Position ajustée manuellement (clic)");
  });

  document.getElementById("geo-zoom-in").addEventListener("click", () => {
    if (ZOOM < 19) { ZOOM++; renderMosaic(); }
  });
  document.getElementById("geo-zoom-out").addEventListener("click", () => {
    if (ZOOM > 3) { ZOOM--; renderMosaic(); }
  });

  // ── Parseur de coordonnées : décimal (point ou virgule), DMS ("16°01'21.0\"N"),
  // ou une paire complète collée dans un seul champ ("16.022500, -16.491361") ──
  function parseSingleCoord(raw) {
    if (!raw) return NaN;
    const str = String(raw).trim();
    const dms = str.match(/(-?\d+(?:[.,]\d+)?)[°:\s]+(\d+(?:[.,]\d+)?)['\s]+(\d+(?:[.,]\d+)?)["\s]*([NSEW])?/i);
    if (dms) {
      const deg = parseFloat(dms[1].replace(",", "."));
      const min = parseFloat(dms[2].replace(",", "."));
      const sec = parseFloat(dms[3].replace(",", "."));
      let val = Math.abs(deg) + min / 60 + sec / 3600;
      if (deg < 0 || /[SW]/i.test(dms[4] || "")) val = -val;
      return val;
    }
    // Décimal — virgule française acceptée uniquement si un seul groupe (pas une paire)
    return parseFloat(str.replace(",", "."));
  }

  function tryParsePair(text) {
    const m = String(text).match(/(-?\d{1,3}[.,]\d+)\s*[,;]\s*(-?\d{1,3}[.,]\d+)/);
    if (!m) return null;
    return { lat: parseFloat(m[1].replace(",", ".")), lng: parseFloat(m[2].replace(",", ".")) };
  }

  function applyManualInputs() {
    // Une paire collée dans un seul des deux champs ?
    const pairFromLat = tryParsePair(latInput.value);
    const pairFromLng = tryParsePair(lngInput.value);
    const pair = pairFromLat || pairFromLng;
    if (pair && Number.isFinite(pair.lat) && Number.isFinite(pair.lng)) {
      showPosition(pair.lat, pair.lng, "Position saisie manuellement");
      return;
    }
    const lat = parseSingleCoord(latInput.value);
    const lng = parseSingleCoord(lngInput.value);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      showPosition(lat, lng, "Position saisie manuellement");
    } else {
      showToast("Coordonnées non reconnues — vérifie le format.", "error");
    }
  }
  document.getElementById("geo-apply-manual").addEventListener("click", applyManualInputs);
  [latInput, lngInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); applyManualInputs(); }
    });
  });

  if (!navigator.geolocation) {
    statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#e65100;"></i> Géolocalisation non disponible sur cet appareil/navigateur.`;
  } else {
    navigator.geolocation.getCurrentPosition(
      (pos) => showPosition(pos.coords.latitude, pos.coords.longitude, "Position actuelle détectée"),
      () => {
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#c62828;"></i> Localisation refusée ou indisponible — saisis les coordonnées manuellement ci-dessous.`;
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  document.getElementById("btn-clear-geo")?.addEventListener("click", async () => {
    try {
      await put(`/api/sites/${site._id}/coordonnees`, { clear: true });
      showToast("Geofencing retiré pour ce site.", "success");
      document.getElementById("gds-modal-overlay")?.remove();
      fetchSites(root);
    } catch {
      showToast("Erreur lors du retrait du geofencing.", "error");
    }
  });
}
