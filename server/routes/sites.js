const express = require("express");
const { v4: uuidv4 } = require("uuid");

const Site = require("../models/Site");
const { authenticate, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const sites = await Site.find({ actif: true }).sort({ nom: 1 });
    const baseUrl =
      process.env.APP_URL || "https://pamecas-pointage.onrender.com";
    const sitesAvecUrl = sites.map((s) => ({
      ...s.toObject(),
      kiosque_url: s.kiosque_token
        ? `${baseUrl}/#/kiosque?ktoken=${s.kiosque_token}`
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
    const site = new Site(req.body);
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
    const updates = req.body || {};

    const site = await Site.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!site) {
      return res.status(404).json({ message: "Site non trouvé." });
    }

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
      const site = await Site.findById(req.params.id);
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

// PATCH /:id/coordonnees — Mise à jour coordonnées GPS du site (kiosque)
router.patch("/:id/coordonnees", authenticate, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
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

// PATCH /:id/pin — Mettre à jour le PIN kiosque pour un site
router.patch(
  "/:id/pin",
  authenticate,
  authorizeRoles("admin", "superadmin"),
  async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || String(pin).length < 4)
        return res
          .status(400)
          .json({ message: "PIN invalide — minimum 4 chiffres" });
      const site = await Site.findByIdAndUpdate(
        req.params.id,
        { kiosque_pin: pin },
        { new: true },
      );
      if (!site) return res.status(404).json({ message: "Site non trouvé" });
      res.json({
        message: "PIN kiosque mis à jour",
        site: { _id: site._id, nom: site.nom },
      });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

module.exports = router;
