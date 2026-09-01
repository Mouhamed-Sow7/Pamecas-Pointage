const express = require("express");
const { v4: uuidv4 } = require("uuid");

const Site = require("../models/Site");
const { authenticate, authorizeRoles, tenantScope } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);
router.use(tenantScope);

// Verifie que le site appartient bien au tenant de l'utilisateur
// (sauf superadmin plateforme / god mode, instance_slug === null => acces cross-tenant)
async function getSiteInTenant(req, id) {
  const site = await Site.findById(id);
  if (!site) return null;
  if (req.user.instance_slug !== null && site.instance_slug !== req.user.instance_slug) {
    return null;
  }
  return site;
}

// ── DEBUG (BUG 1) — diagnostiquer les doublons de site ──────────────
// GET /:agentMatricule/debug-pin-mismatch
// Compare le site_id réel de l'agent (y compris sites inactifs, invisibles
// dans la liste admin normale qui filtre actif:true) avec tous les sites
// portant un nom similaire. Permet de détecter un doublon : l'admin
// régénère le PIN sur le site "actif" affiché dans la liste, alors que
// l'agent est rattaché à un AUTRE document Site (souvent désactivé) qui,
// lui, ne reçoit jamais le nouveau PIN.
router.get(
  "/debug-pin-mismatch/:matricule",
  authorizeRoles("admin", "superadmin"),
  async (req, res) => {
    try {
      const Agent = require("../models/Agent");
      const agent = await Agent.findOne({
        matricule: req.params.matricule.toUpperCase(),
      }).select("matricule nom prenom site_id");
      if (!agent) {
        return res.status(404).json({ message: "Agent introuvable" });
      }

      const agentSite = await Site.findById(agent.site_id);

      const candidats = agentSite
        ? await Site.find({
            _id: { $ne: agentSite._id },
            $or: [{ nom: agentSite.nom }, { code: agentSite.code }],
          }).select("nom code actif kiosque_pin kiosque_pin_expires_at instance_slug")
        : [];

      return res.json({
        agent: {
          matricule: agent.matricule,
          nom_complet: `${agent.prenom} ${agent.nom}`,
          site_id_reel: agent.site_id,
        },
        site_reellement_rattache: agentSite
          ? {
              _id: agentSite._id,
              nom: agentSite.nom,
              code: agentSite.code,
              actif: agentSite.actif,
              kiosque_pin: agentSite.kiosque_pin,
              kiosque_pin_expires_at: agentSite.kiosque_pin_expires_at,
              instance_slug: agentSite.instance_slug,
              visible_dans_liste_admin: agentSite.actif === true,
            }
          : null,
        autres_sites_avec_meme_nom_ou_code: candidats,
        diagnostic:
          !agentSite
            ? "L'agent n'a AUCUN site valide (site_id pointe vers un document inexistant)."
            : agentSite.actif !== true
              ? "⚠️ Le site réel de l'agent est INACTIF (actif:false) — il n'apparaît PAS dans la liste admin (qui filtre actif:true). C'est probablement pour ça que le PIN régénéré via l'admin n'atteint jamais cet agent."
              : candidats.length > 0
                ? "⚠️ Un ou plusieurs sites portent le même nom/code — vérifiez que l'admin modifie bien le bon _id."
                : "Le site de l'agent est actif et unique — le problème est ailleurs (voir kiosque_pin ci-dessus).",
      });
    } catch (err) {
      console.error("Erreur debug-pin-mismatch:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

router.get("/", async (req, res) => {
  try {
    const sites = await Site.find({ actif: true, ...req.instanceFilter }).sort({ nom: 1 });
    const baseUrl =
      process.env.APP_URL || "https://pamecas-pointage.onrender.com";
    const sitesAvecUrl = sites.map((s) => ({
      ...s.toObject(),
      kiosque_url: s.kiosque_token
        ? `${baseUrl}/kiosk?ktoken=${s.kiosque_token}`
        : null,
    }));
    return res.json({ data: sitesAvecUrl });
  } catch (err) {
    console.error("Erreur lors de la récupération des sites:", err);
    return res
      .status(500)
      .json({ message: "Erreur lors de la récupération des sites." });
  }
});

router.post("/", authorizeRoles("superadmin"), async (req, res) => {
  try {
    const site = new Site({
      ...req.body,
      instance_slug: req.user.instance_slug || "pamecas",
    });
    site.kiosque_token = uuidv4();
    site.kiosque_token_created_at = new Date();
    await site.save();
    return res.status(201).json(site);
  } catch (err) {
    console.error("Erreur lors de la création du site:", err);
    return res
      .status(500)
      .json({ message: "Erreur lors de la création du site." });
  }
});

router.put("/:id", authorizeRoles("superadmin"), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...(req.body || {}) };
    delete updates.instance_slug; // non modifiable par ce endpoint

    const existing = await getSiteInTenant(req, id);
    if (!existing) {
      return res.status(404).json({ message: "Site non trouvé." });
    }

    const site = await Site.findByIdAndUpdate(id, updates, {
      new: true,
    });

    return res.json(site);
  } catch (err) {
    console.error("Erreur lors de la mise à jour du site:", err);
    return res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour du site." });
  }
});

// Générer token kiosque permanent pour une agence
router.post(
  "/:id/kiosque-token",
  authorizeRoles("superadmin", "directeur_regional", "admin"),
  async (req, res) => {
    try {
      const site = await getSiteInTenant(req, req.params.id);
      if (!site) return res.status(404).json({ message: "Site non trouvé." });

      // Vérifier accès multi-tenant
      if (req.user.role !== "superadmin") {
        const siteIdStr = site._id.toString();
        const aAcces =
          (req.user.role === "directeur_regional" &&
            req.user.sites_ids.includes(siteIdStr)) ||
          req.user.site_id === siteIdStr;
        if (!aAcces) return res.status(403).json({ message: "Accès refusé." });
      }

      site.kiosque_token = uuidv4();
      site.kiosque_token_created_at = new Date();
      await site.save();

      return res.json({
        token: site.kiosque_token,
        created_at: site.kiosque_token_created_at,
        site: { _id: site._id, nom: site.nom, code: site.code },
      });
    } catch (err) {
      return res.status(500).json({ message: "Erreur génération token." });
    }
  },
);

// Révoquer token kiosque
router.delete(
  "/:id/kiosque-token",
  authorizeRoles("superadmin", "admin"),
  async (req, res) => {
    try {
      const site = await getSiteInTenant(req, req.params.id);
      if (!site) return res.status(404).json({ message: "Site non trouvé." });
      await Site.findByIdAndUpdate(req.params.id, {
        kiosque_token: null,
        kiosque_token_created_at: null,
      });
      return res.json({ message: "Token kiosque révoqué." });
    } catch (err) {
      return res.status(500).json({ message: "Erreur révocation." });
    }
  },
);

// PATCH /:id/coordonnees — Définir (ou retirer) la position GPS du site (geofencing kiosque)
router.patch("/:id/coordonnees", authenticate, async (req, res) => {
  try {
    const { latitude, longitude, clear } = req.body;

    if (clear) {
      const site = await Site.findByIdAndUpdate(
        req.params.id,
        { $unset: { coordonnees: "" } },
        { new: true },
      );
      if (!site) return res.status(404).json({ message: "Site introuvable" });
      return res.json({ message: "Geofencing retiré — ce site n'a plus de zone de pointage restreinte.", site });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "latitude et longitude requis" });
    }
    const site = await Site.findByIdAndUpdate(
      req.params.id,
      { "coordonnees.latitude": latitude, "coordonnees.longitude": longitude },
      { new: true },
    );
    if (!site) return res.status(404).json({ message: "Site introuvable" });
    res.json({ message: "Coordonnées mises à jour", site });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Helper PIN rotation ────────────────────────────────────────────
function genererPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function expiresIn8h() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

// PATCH /:id/pin — Définir PIN fixe manuellement (legacy)
router.patch(
  "/:id/pin",
  authenticate,
  authorizeRoles("admin", "superadmin"),
  async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || String(pin).length < 4)
        return res.status(400).json({ message: "PIN invalide — minimum 4 chiffres" });
      const existing = await getSiteInTenant(req, req.params.id);
      if (!existing) return res.status(404).json({ message: "Site non trouvé" });
      const site = await Site.findByIdAndUpdate(
        req.params.id,
        { kiosque_pin: pin, kiosque_pin_expires_at: null, kiosque_pin_rotated_at: new Date() },
        { new: true },
      );
      if (!site) return res.status(404).json({ message: "Site non trouvé" });
      res.json({ message: "PIN kiosque mis à jour", site: { _id: site._id, nom: site.nom, kiosque_pin: site.kiosque_pin } });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// POST /:id/rotate-pin — Générer un nouveau PIN aléatoire (rotatif)
router.post(
  "/:id/rotate-pin",
  authenticate,
  authorizeRoles("admin", "superadmin"),
  async (req, res) => {
    try {
      const pin = genererPin();
      const existing = await getSiteInTenant(req, req.params.id);
      if (!existing) return res.status(404).json({ message: "Site non trouvé" });
      const site = await Site.findByIdAndUpdate(
        req.params.id,
        {
          kiosque_pin: pin,
          kiosque_pin_expires_at: expiresIn8h(),
          kiosque_pin_rotated_at: new Date(),
        },
        { new: true },
      );
      if (!site) return res.status(404).json({ message: "Site non trouvé" });
      res.json({
        message: "PIN kiosque rotatif généré",
        site: {
          _id: site._id,
          nom: site.nom,
          kiosque_pin: site.kiosque_pin,
          kiosque_pin_expires_at: site.kiosque_pin_expires_at,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// GET / — inclut le PIN dans la réponse pour les admins
// (déjà géré dans le GET existant — le champ kiosque_pin est dans le modèle)

module.exports = router;
