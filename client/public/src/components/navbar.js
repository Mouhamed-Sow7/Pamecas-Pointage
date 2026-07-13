import { getBadgeCount } from "../store/syncManager.js";

export function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const main = document.getElementById("main-content");
  if (!sidebar) return;
  if (window.innerWidth >= 1025) {
    sidebar.classList.toggle("collapsed");
    if (main) main.classList.toggle("sidebar-collapsed");
  }
}

export function openSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (!sidebar) return;
  sidebar.classList.add("open");
  if (overlay) overlay.classList.add("visible");
}

export function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (!sidebar) return;
  sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("visible");
}

export function initResponsiveSidebar() {
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1025) closeSidebar();
  });
}

export async function renderNavbar(container, currentRoute, user) {
  const pending = await getBadgeCount();
  const isOnline = navigator.onLine;

  // Charger les badges de demandes en attente (admin/superadmin seulement)
  let nbDemandesDeco = 0;
  let nbCongesAttente = 0;
  const isManager = user && ["admin", "superadmin", "directeur_regional"].includes(user.role);
  if (isManager) {
    const token = localStorage.getItem("pamecas_token");
    try {
      if (user.role === "admin" || user.role === "superadmin") {
        const r = await fetch("/api/agents/demandes-deconnexion", {
          headers: { Authorization: "Bearer " + token },
        });
        if (r.ok) { const d = await r.json(); nbDemandesDeco = (d.data || []).length; }
      }
    } catch { /* silencieux */ }
    try {
      const r = await fetch("/api/conges?statut=en_attente", {
        headers: { Authorization: "Bearer " + token },
      });
      if (r.ok) { const d = await r.json(); nbCongesAttente = (d.data || []).length; }
    } catch { /* silencieux */ }
  }

  const links = [
    {
      path: "#/dashboard",
      label: "Dashboard",
      icon: '<i class="fa-regular fa-house"></i>',
    },
  ];

  // Pointage : uniquement admin/pointeur/superviseur et superadmin UI (pas DR)
  if (
    user &&
    ["admin", "superadmin", "superviseur", "pointeur"].includes(user.role)
  ) {
    links.push({
      path: "#/pointage",
      label: "Pointage",
      icon: '<i class="fa-regular fa-circle-dot"></i>',
    });
  }

  // Agents : admin/superviseur seulement
  if (user && ["superadmin", "admin", "superviseur"].includes(user.role)) {
    links.push({
      path: "#/agents",
      label: "Agents",
      icon: '<i class="fa-solid fa-users"></i>',
    });
  }

  // Demandes RH — section centralisée (admin/superadmin/DR)
  if (user && ["superadmin", "admin", "directeur_regional"].includes(user.role)) {
    const totalDemandes = nbDemandesDeco + nbCongesAttente;
    links.push({
      path: "#/demandes",
      label: "Demandes",
      icon: '<i class="fa-solid fa-inbox"></i>',
      badge: totalDemandes > 0 ? totalDemandes : 0,
    });
  }

  // Rapports : DR + admin + superadmin
  if (
    user &&
    ["superadmin", "directeur_regional", "admin"].includes(user.role)
  ) {
    links.push({
      path: "#/rapports",
      label: "Rapports",
      icon: '<i class="fa-regular fa-file-alt"></i>',
    });
  }

  // Congés : superadmin + admin + DR
  if (
    user &&
    ["superadmin", "admin", "directeur_regional"].includes(user.role)
  ) {
    links.push({
      path: "#/conges",
      label: "Congés",
      icon: '<i class="fa-solid fa-calendar-days"></i>',
    });
  }

  // Agences : superadmin seulement
  if (user && user.role === "superadmin") {
    links.push({
      path: "#/sites",
      label: "Agences",
      icon: '<i class="fa-regular fa-building"></i>',
    });
  }

  // Utilisateurs : superadmin seulement
  if (user && user.role === "superadmin") {
    links.push({
      path: "#/users",
      label: "Utilisateurs",
      icon: '<i class="fa-solid fa-users-gear"></i>',
    });
  }

  const htmlLinks = links
    .map((link) => {
      const isActive = currentRoute === link.path.replace("#", "");
      const badgeHtml = link.badge
        ? `<span class="nav-badge">${link.badge > 9 ? "9+" : link.badge}</span>`
        : "";
      return `
      <button class="nav-link ${isActive ? "nav-link-active" : ""}" data-path="${link.path}" style="position:relative;">
        <span style="font-size:1rem;width:20px;text-align:center;">${link.icon}</span>
        <span class="nav-text">${link.label}</span>
        ${badgeHtml}
      </button>
    `;
    })
    .join("");

  // Nom de l'instance (tenant) — affiché sous le logo
  const instanceNom =
    user?.site_nom || (user?.role === "superadmin" ? "Toutes agences" : "");

  container.innerHTML = `
    <div class="nav-header">
      <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" type="button" title="Reduire">
        <i class="fa-solid fa-bars"></i>
      </button>
      <div class="logo">
        <div class="logo-mark">SP</div>
        <div class="logo-text">
          <div class="title">SmartPointage</div>
          <div class="subtitle">${instanceNom}</div>
        </div>
      </div>
    </div>
    <div class="sidebar-scroll">
      <nav class="nav-menu">${htmlLinks}</nav>
    </div>
    <div class="nav-footer">
      <div class="status-row">
        <span class="status-dot ${isOnline ? "online" : "offline"}"></span>
        <span class="status-text">${isOnline ? "En ligne" : "Hors ligne"}</span>
      </div>
      ${
        pending > 0
          ? `
      <div class="status-row">
        <span class="status-text">Sync</span>
        <span class="badge badge-pending">${pending} en attente</span>
      </div>`
          : ""
      }
      <div class="status-row" style="overflow:hidden;">
        <i class="fa-solid fa-user" style="font-size:0.7rem;flex-shrink:0;color:rgba(255,255,255,0.6);"></i>
        <span class="status-text">${user?.username || ""} · ${user?.role || ""}</span>
      </div>
      <button id="btn-logout" class="btn-logout">
        <i class="fa-solid fa-right-from-bracket"></i>
        <span class="nav-text">Deconnexion</span>
      </button>
    </div>
  `;

  container.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeSidebar();
      window.location.hash = btn.getAttribute("data-path");
    });
  });

  container.querySelector("#btn-logout")?.addEventListener("click", () => {
    localStorage.removeItem("pamecas_token");
    localStorage.removeItem("pamecas_user");
    window.location.hash = "#/login";
  });

  container
    .querySelector("#sidebar-collapse-btn")
    ?.addEventListener("click", toggleSidebar);
}
