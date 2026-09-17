// ─────────────────────────────────────────────────────────────────
// badge.js — "Mon badge" : QR dynamique de l'agent, consultable même
// hors ligne (une fois connecté au moins une fois avec réseau).
//
// Fonctionnement :
//  1. En ligne, la 1ère fois : login via /api/agent-portal/login
//     (Basic matricule:mdp), puis on met en cache matricule+secret
//     TOTP localement (IndexedDB, voir store/badgeQR.js).
//  2. Ensuite, à chaque ouverture (même sans réseau car la page et
//     ses assets sont précachés par le service worker) : on relit le
//     cache local et on génère le QR nous-mêmes, sans appeler le
//     serveur — la même logique HMAC que le serveur (30s/fenêtre).
// ─────────────────────────────────────────────────────────────────

import {
  cacheBadge,
  getCachedBadge,
  generateCurrentQRData,
  secondesRestantes,
} from "../store/badgeQR.js";
import { showToast } from "../components/toast.js";

let refreshTimer = null;
let qrLibLoaded = false;

async function ensureQrLib() {
  if (qrLibLoaded || window.qrcode) {
    qrLibLoaded = true;
    return;
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/app/src/libs/qrcode-generator.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  qrLibLoaded = true;
}

function drawQR(container, data) {
  container.innerHTML = "";
  // Niveau de correction M : bon compromis lisibilité/robustesse pour
  // un QR affiché sur un écran de téléphone (reflets, petite taille).
  const qr = window.qrcode(0, "M");
  qr.addData(data);
  qr.make();
  container.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2 });
  const svg = container.querySelector("svg");
  if (svg) {
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";
  }
}

async function login(matricule, motDePasse) {
  const basic = btoa(`${matricule}:${motDePasse}`);
  const res = await fetch("/api/agent-portal/login", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Connexion impossible.");
  }
  return data;
}

async function refreshBadgeFromServer() {
  try {
    const token = localStorage.getItem("agent_token");
    if (!token) return null;
    const res = await fetch("/api/agent-portal/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const agent = await res.json();
    await cacheBadge(agent);
    return agent;
  } catch {
    // Hors ligne ou serveur injoignable — on continue avec le cache local.
    return null;
  }
}

function renderLoginForm(root, onSuccess) {
  root.innerHTML = `
    <div style="max-width:340px;margin:40px auto;padding:24px;">
      <h2 style="font-size:1.1rem;margin-bottom:16px;text-align:center;">Mon badge</h2>
      <p style="font-size:0.85rem;color:#607d8b;margin-bottom:16px;text-align:center;">
        Connectez-vous une première fois (réseau requis) pour activer
        votre badge hors ligne.
      </p>
      <input id="badge-matricule" placeholder="Matricule" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ddd;border-radius:8px;" />
      <input id="badge-password" type="password" placeholder="Mot de passe" style="width:100%;padding:10px;margin-bottom:14px;border:1px solid #ddd;border-radius:8px;" />
      <button id="badge-login-btn" style="width:100%;padding:12px;background:#1565c0;color:white;border:none;border-radius:8px;font-weight:600;">
        Se connecter
      </button>
      <div id="badge-login-err" style="color:#c62828;font-size:0.8rem;margin-top:10px;min-height:18px;"></div>
    </div>
  `;

  root.querySelector("#badge-login-btn").addEventListener("click", async () => {
    const matricule = root.querySelector("#badge-matricule").value.trim();
    const motDePasse = root.querySelector("#badge-password").value;
    const errEl = root.querySelector("#badge-login-err");
    errEl.textContent = "";
    if (!matricule || !motDePasse) {
      errEl.textContent = "Matricule et mot de passe requis.";
      return;
    }
    try {
      const data = await login(matricule, motDePasse);
      localStorage.setItem("agent_token", data.token);
      await cacheBadge(data.agent);
      onSuccess(data.agent);
    } catch (e) {
      errEl.textContent = navigator.onLine
        ? e.message
        : "Hors ligne — la première connexion nécessite du réseau.";
    }
  });
}

function renderBadgeShell(root, badge) {
  root.innerHTML = `
    <div style="max-width:340px;margin:20px auto;padding:0 16px;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-weight:700;font-size:1.05rem;">${badge.prenom || ""} ${badge.nom || ""}</div>
        <div style="color:#607d8b;font-size:0.85rem;">${badge.matricule}${badge.site_nom ? " · " + badge.site_nom : ""}</div>
      </div>
      <div id="badge-offline-banner" style="display:none;background:#fff3e0;color:#e65100;font-size:0.78rem;padding:8px 12px;border-radius:8px;margin-bottom:12px;text-align:center;">
        <i class="fa-solid fa-wifi"></i> Hors ligne — QR généré localement
      </div>
      <div id="badge-qr-box" style="background:white;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(0,0,0,0.08);"></div>
      <div style="text-align:center;margin-top:12px;color:#90a4ae;font-size:0.78rem;">
        Renouvellement dans <span id="badge-countdown">30</span>s
      </div>
    </div>
  `;
}

async function tickQR(root, badge) {
  const { qrData } = await generateCurrentQRData(badge.matricule, badge.totp_secret);
  const box = root.querySelector("#badge-qr-box");
  if (box) drawQR(box, qrData);

  const banner = root.querySelector("#badge-offline-banner");
  if (banner) banner.style.display = navigator.onLine ? "none" : "block";

  const countdownEl = root.querySelector("#badge-countdown");
  if (countdownEl) countdownEl.textContent = secondesRestantes();
}

export async function renderBadge(root) {
  await ensureQrLib();

  const cached = await getCachedBadge();

  const start = (badge) => {
    renderBadgeShell(root, badge);
    tickQR(root, badge);
    if (refreshTimer) clearInterval(refreshTimer);
    // Toutes les secondes pour le compte à rebours ; le QR lui-même ne
    // change effectivement que toutes les 30s (fenêtre HMAC).
    refreshTimer = setInterval(() => tickQR(root, badge), 1000);
  };

  if (cached) {
    // Cache dispo → on affiche IMMÉDIATEMENT, même sans réseau.
    start(cached);
    // Puis, si on est en ligne, on rafraîchit le cache en tâche de fond
    // (au cas où le secret aurait changé côté admin, etc).
    if (navigator.onLine) {
      const fresh = await refreshBadgeFromServer();
      if (fresh) start(fresh);
    }
    return;
  }

  if (!navigator.onLine) {
    root.innerHTML = `
      <div style="max-width:340px;margin:60px auto;padding:24px;text-align:center;color:#607d8b;">
        <i class="fa-solid fa-wifi" style="font-size:2rem;margin-bottom:12px;"></i>
        <p>Vous êtes hors ligne et aucun badge n'a encore été activé sur cet appareil.</p>
        <p style="font-size:0.85rem;">Connectez-vous une première fois avec du réseau.</p>
      </div>
    `;
    return;
  }

  renderLoginForm(root, (agent) => {
    showToast("Badge activé — disponible hors ligne désormais.", "success");
    start(agent);
  });
}

export function unmountBadge() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
