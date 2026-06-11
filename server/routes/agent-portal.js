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

      const agent = await Agent.findOne({
        matricule: matricule.toUpperCase(),
      }).populate("site_id", "nom code");
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

    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const finMois = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const pointagesMois = await Pointage.find({
      agent_id: agent._id,
      date: { $gte: debutMois, $lte: finMois },
    }).sort({ date: -1 });

    const presencesMois = pointagesMois.filter(
      (p) => p.statut === "present",
    ).length;
    const retardsMois = pointagesMois.filter(
      (p) => p.statut === "retard",
    ).length;

    let joursOuvres = 0;
    const cursor = new Date(debutMois);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    while (cursor <= today && cursor <= finMois) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) joursOuvres++;
      cursor.setDate(cursor.getDate() + 1);
    }
    const absencesMois = Math.max(0, joursOuvres - presencesMois - retardsMois);

    const congesApprouves = await Conge.find({
      agent_id: agent._id,
      statut: "approuve",
    });
    const congesEnAttente = await Conge.find({
      agent_id: agent._id,
      statut: "en_attente",
    });

    const joursPris = congesApprouves.reduce(
      (s, c) => s + (c.nb_jours || 0),
      0,
    );
    const joursPending = congesEnAttente.reduce(
      (s, c) => s + (c.nb_jours || 0),
      0,
    );
    const joursAcquis = agent.jours_conge_annuels || 30;
    const soldeConge = Math.max(0, joursAcquis - joursPris);

    const pointagesRecents = await Pointage.find({ agent_id: agent._id })
      .sort({ date: -1 })
      .limit(20)
      .lean();

    res.json({
      presencesMois,
      absencesMois,
      retardsMois,
      soldeConge,
      joursAcquis,
      joursPris,
      joursPending,
      pointagesRecents,
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
