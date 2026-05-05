const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Agent = require("../models/Agent");
const Conge = require("../models/Conge");
const Pointage = require("../models/Pointage");

const router = express.Router();

// Middleware d'authentification agent - Support Basic Auth (login) et Bearer JWT (API)
const authenticateAgent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Authentification requise" });
    }

    // Gestion Basic Auth (pour le login)
    if (authHeader.startsWith("Basic ")) {
      const base64Credentials = authHeader.split(" ")[1];
      const credentials = Buffer.from(base64Credentials, "base64").toString(
        "ascii",
      );
      const [matricule, password] = credentials.split(":");

      if (!matricule || !password) {
        return res
          .status(401)
          .json({ message: "Matricule et mot de passe requis" });
      }

      const agent = await Agent.findOne({ matricule }).populate(
        "site_id",
        "nom code",
      );
      if (!agent || !agent.password_hash) {
        return res
          .status(401)
          .json({ message: "Agent non trouvé ou compte non activé" });
      }

      const isValidPassword = await bcrypt.compare(
        password,
        agent.password_hash,
      );
      if (!isValidPassword) {
        return res.status(401).json({ message: "Mot de passe incorrect" });
      }

      req.agent = agent;
      return next();
    }

    // Gestion Bearer JWT (pour les appels API après login)
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "Token manquant" });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");

        if (decoded.role !== "agent") {
          return res.status(403).json({ message: "Accès non autorisé" });
        }

        const agent = await Agent.findById(decoded.id).populate(
          "site_id",
          "nom code",
        );
        if (!agent) {
          return res.status(401).json({ message: "Agent non trouvé" });
        }

        req.agent = agent;
        return next();
      } catch (jwtError) {
        console.error("Erreur JWT:", jwtError);
        return res.status(401).json({ message: "Token invalide ou expiré" });
      }
    }

    // Type d'authentification non supporté
    return res
      .status(401)
      .json({ message: "Type d'authentification non supporté" });
  } catch (error) {
    console.error("Erreur authentification agent:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// POST /login - Authentification agent
router.post("/login", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const token = jwt.sign(
      { id: agent._id, matricule: agent.matricule, role: "agent" },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" },
    );

    res.json({
      message: "Connexion réussie",
      agent: {
        _id: agent._id,
        nom: agent.nom,
        prenom: agent.prenom,
        matricule: agent.matricule,
        site: agent.site_id,
        totp_enabled: agent.totp_enabled,
        totp_secret: agent.totp_secret, // ← ajouter
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
    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);

    const pointagesMois = await Pointage.find({
      agent_id: agent._id,
      date: { $gte: debutMois },
    }).sort({ date: -1 });

    const totalPointages = pointagesMois.length;
    const pointagesAujourdHui = pointagesMois.filter(
      (p) => p.date.toDateString() === new Date().toDateString(),
    ).length;

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
    res.status(201).json({ message: "Demande de congé soumise", conge });
  } catch (error) {
    console.error("Erreur création congé:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
