const express = require("express");
const Conge = require("../models/Conge");
const Agent = require("../models/Agent");
const {
  authenticate,
  authorizeRoles,
  tenantFilter,
} = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);
router.use(tenantFilter);

// GET / — Liste des demandes (admin/superadmin)
router.get(
  "/",
  authorizeRoles("superadmin", "admin", "directeur_regional"),
  async (req, res) => {
    try {
      const { statut, site_id } = req.query;
      const filter = { ...req.siteFilter };
      if (statut) filter.statut = statut;
      if (site_id) filter.site_id = site_id;

      const conges = await Conge.find(filter)
        .populate("agent_id", "nom prenom matricule")
        .populate("site_id", "nom code")
        .sort({ createdAt: -1 });

      return res.json({ data: conges });
    } catch (err) {
      return res.status(500).json({ message: "Erreur." });
    }
  },
);

// PUT /:id — Approuver ou refuser
router.put("/:id", authorizeRoles("superadmin", "admin"), async (req, res) => {
  try {
    const { statut, commentaire_rh } = req.body;

    if (!["approuve", "refuse"].includes(statut)) {
      return res.status(400).json({ message: "Statut invalide." });
    }

    const conge = await Conge.findById(req.params.id);
    if (!conge)
      return res.status(404).json({ message: "Demande introuvable." });

    // Tenant check
    if (
      req.user.role !== "superadmin" &&
      conge.site_id?.toString() !== req.user.site_id
    ) {
      return res.status(403).json({ message: "Accès refusé." });
    }

    conge.statut = statut;
    conge.commentaire_rh = commentaire_rh || "";
    conge.approuve_par = req.user.id;
    conge.approuve_le = new Date();
    await conge.save();

    return res.json(conge);
  } catch (err) {
    return res.status(500).json({ message: "Erreur." });
  }
});

module.exports = router;
