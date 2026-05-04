const express = require("express");
const bcrypt = require("bcryptjs");
const Agent = require("../models/Agent");
const Conge = require("../models/Conge");
const Pointage = require("../models/Pointage");
const {
  authenticate,
  authorizeRoles,
  tenantFilter,
} = require("../middleware/auth");

const router = express.Router();

// Middleware d'authentification agent
const authenticateAgent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return res.status(401).json({ message: "Authentification requise" });
    }

    const base64Credentials = authHeader.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
    const [matricule, password] = credentials.split(":");

    if (!matricule || !password) {
      return res.status(401).json({ message: "Matricule et mot de passe requis" });
    }

    const agent = await Agent.findOne({ matricule }).populate("site_id", "nom code");
    if (!agent || !agent.password_hash) {
      return res.status(401).json({ message: "Agent non trouvé ou compte non activé" });
    }

    const isValidPassword = await bcrypt.compare(password, agent.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Mot de passe incorrect" });
    }

    req.agent = agent;
    next();
  } catch (error) {
    console.error("Erreur authentification agent:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// POST /login - Authentification agent
router.post("/login", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;

    // Générer un token JWT pour la session
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      { id: agent._id, matricule: agent.matricule, role: "agent" },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" }
    );

    res.json({
      message: "Connexion réussie",
      agent: {
        _id: agent._id,
        nom: agent.nom,
        prenom: agent.prenom,
        matricule: agent.matricule,
        site: agent.site_id,
      },
      token,
    });
  } catch (error) {
    console.error("Erreur login:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /stats - Statistiques de l'agent
router.get("/stats", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;

    // Pointages du mois en cours
    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);

    const pointagesMois = await Pointage.find({
      agent_id: agent._id,
      date: { $gte: debutMois },
    }).sort({ date: -1 });

    // Statistiques
    const totalPointages = pointagesMois.length;
    const pointagesAujourdHui = pointagesMois.filter(
      (p) => p.date.toDateString() === new Date().toDateString()
    ).length;

    // Congés en attente
    const congesEnAttente = await Conge.countDocuments({
      agent_id: agent._id,
      statut: "en_attente",
    });

    res.json({
      totalPointages,
      pointagesAujourdHui,
      congesEnAttente,
      dernierPointage: pointagesMois[0] || null,
    });
  } catch (error) {
    console.error("Erreur stats:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /conges - Liste des congés de l'agent
router.get("/conges", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;

    const conges = await Conge.find({ agent_id: agent._id })
      .populate("site_id", "nom code")
      .sort({ createdAt: -1 });

    res.json({ data: conges });
  } catch (error) {
    console.error("Erreur conges:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /conges - Demander un congé
router.post("/conges", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const { date_debut, date_fin, motif, commentaire } = req.body;

    if (!date_debut || !date_fin || !motif) {
      return res.status(400).json({ message: "Champs requis manquants" });
    }

    const conge = new Conge({
      agent_id: agent._id,
      site_id: agent.site_id,
      date_debut: new Date(date_debut),
      date_fin: new Date(date_fin),
      motif,
      commentaire: commentaire || "",
      statut: "en_attente",
    });

    await conge.save();

    res.status(201).json({
      message: "Demande de congé soumise",
      conge,
    });
  } catch (error) {
    console.error("Erreur création congé:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
      return res.status(400).json({ message: "Données incomplètes." });
    }

    // RBAC : vérifier le solde disponible
    const annee = new Date().getFullYear();
    const moisTravailles = Math.min(new Date().getMonth() + 1, 12);
    const jours_acquis = Math.floor(moisTravailles * 2.5);

    const [approuves, enAttente] = await Promise.all([
      Conge.aggregate([
        {
          $match: {
            agent_id: agent._id,
            statut: "approuve",
            date_debut: { $gte: `${annee}-01-01` },
          },
        },
        { $group: { _id: null, total: { $sum: "$nb_jours" } } },
      ]),
      Conge.aggregate([
        {
          $match: {
            agent_id: agent._id,
            statut: "en_attente",
            date_debut: { $gte: `${annee}-01-01` },
          },
        },
        { $group: { _id: null, total: { $sum: "$nb_jours" } } },
      ]),
    ]);

    const jours_pris = approuves[0]?.total || 0;
    const jours_pending = enAttente[0]?.total || 0;
    const solde = Math.max(0, jours_acquis - jours_pris - jours_pending);

    if (nb_jours > solde) {
      return res.status(400).json({
        message: `Solde insuffisant: ${nb_jours} demandés, ${solde} disponibles.`,
      });
    }

    const conge = new Conge({
      agent_id: agent._id,
      site_id: agent.site_id._id || agent.site_id,
      date_debut,
      date_fin,
      nb_jours,
      type: type || "annuel",
      motif: motif || "",
      statut: "en_attente",
    });

    await conge.save();
    return res.status(201).json({ message: "Demande soumise.", conge });
  } catch (err) {
    return res.status(500).json({ message: "Erreur soumission." });
  }
});

module.exports = router;
