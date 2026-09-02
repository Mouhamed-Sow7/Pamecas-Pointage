const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Agent = require("../models/Agent");
const Conge = require("../models/Conge");
const Pointage = require("../models/Pointage");
const Site = require("../models/Site");

// Sécurité: si le populate("site_id", ...) ne remonte pas le PIN (site_id non
// peuplé, ObjectId brut, doc supprimé/recréé, etc.), on retente une lecture
// directe du Site pour ne jamais bloquer l'agent à tort. On log systématiquement
// pour diagnostiquer le BUG 1 (PIN toujours "non configuré").
async function ensureSitePopulatedWithPin(agent, context) {
  const rawSiteId = agent.site_id;
  const isPopulated =
    rawSiteId && typeof rawSiteId === "object" && "kiosque_pin" in rawSiteId;

  console.log(
    `[PIN-DEBUG:${context}] agent=${agent.matricule} site_id populé=${isPopulated} raw=`,
    isPopulated
      ? { _id: rawSiteId._id, nom: rawSiteId.nom, kiosque_pin: rawSiteId.kiosque_pin }
      : rawSiteId,
  );

  if (isPopulated && rawSiteId.kiosque_pin) {
    return agent;
  }

  // Fallback: rawSiteId peut être un ObjectId non-peuplé si le populate a
  // échoué silencieusement. On refait une lecture directe.
  const siteId = isPopulated ? rawSiteId._id : rawSiteId;
  if (!siteId) {
    console.warn(`[PIN-DEBUG:${context}] agent=${agent.matricule} n'a AUCUN site_id en DB`);
    return agent;
  }

  const freshSite = await Site.findById(siteId).select(
    "nom code kiosque_pin kiosque_pin_expires_at",
  );

  if (!freshSite) {
    console.warn(
      `[PIN-DEBUG:${context}] agent=${agent.matricule} site_id=${siteId} introuvable en DB (site supprimé/recréé avec un nouvel _id ?)`,
    );
    return agent;
  }

  console.log(
    `[PIN-DEBUG:${context}] fallback réussi — PIN récupéré directement: ${freshSite.kiosque_pin}`,
  );
  agent.site_id = freshSite;
  return agent;
}

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
      }).populate("site_id", "nom code kiosque_pin kiosque_pin_expires_at");
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

        // Récupérer uniquement le champ session_token pour la vérification
        const agentSession = await Agent.findById(decoded.id).select(
          "session_token",
        );
        if (!agentSession) {
          return res.status(401).json({ message: "Agent non trouvé" });
        }

        // Si le session_id du token ne correspond pas à celui en DB => session expirée
        if (decoded.session_id !== agentSession.session_token) {
          return res.status(401).json({ error: "SESSION_EXPIRED" });
        }

        // charger l'agent complet pour la suite (profil, site, etc.)
        const agent = await Agent.findById(decoded.id).populate(
          "site_id",
          "nom code kiosque_pin kiosque_pin_expires_at",
        );
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

    // ── Session active détectée → bloquer le login ─────────────────
    if (agent.session_token) {
      // Vérifier si une demande de déconnexion est en attente (approuvée par admin)
      const demandeApprouvee = agent.demande_deconnexion?.statut === "approuvee";
      if (!demandeApprouvee) {
        return res.status(409).json({
          error: "SESSION_ACTIVE",
          message: "Une session est déjà active sur un autre appareil.",
          device: agent.session_device || null,
          matricule: agent.matricule,
          has_demande: agent.demande_deconnexion?.statut === "en_attente",
        });
      }
      // Demande approuvée → réinitialiser le champ avant de continuer
      await Agent.findByIdAndUpdate(agent._id, {
        demande_deconnexion: { statut: null, motif: null, date_demande: null },
      });
    }

    // Générer une session unique et l'enregistrer de manière atomique
    const sessionId = require("crypto").randomUUID();
    const update = { session_token: sessionId };
    if (req.headers["x-device-fingerprint"]) {
      update.session_device = req.headers["x-device-fingerprint"];
    }
    await Agent.findByIdAndUpdate(agent._id, update);

    const token = jwt.sign(
      {
        id: agent._id,
        matricule: agent.matricule,
        role: "agent",
        session_id: sessionId,
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" },
    );

    await ensureSitePopulatedWithPin(agent, "POST /login");
    const sitePin = agent.site_id?.kiosque_pin ?? null;
    res.json({
      message: "Connexion réussie",
      agent: {
        _id: agent._id,
        nom: agent.nom,
        prenom: agent.prenom,
        matricule: agent.matricule,
        site_id: agent.site_id,
        totp_enabled: agent.totp_enabled,
        totp_secret: agent.totp_secret,
        kiosque_pin: sitePin,
      },
      token,
    });
  } catch (error) {
    console.error("Erreur login:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /me - Retourne le profil agent (utilisé par le portail agent pour rafraîchir)
router.get("/me", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;
    await ensureSitePopulatedWithPin(agent, "GET /me");
    // Retourner l'agent avec site_id populé (kiosque_pin inclus)
    return res.json({
      _id: agent._id,
      nom: agent.nom,
      prenom: agent.prenom,
      matricule: agent.matricule,
      poste: agent.poste,
      type_contrat: agent.type_contrat,
      statut: agent.statut,
      totp_enabled: agent.totp_enabled,
      totp_secret: agent.totp_secret,
      jours_conge_annuels: agent.jours_conge_annuels,
      jours_conge_acquis: agent.jours_conge_acquis,
      instance_slug: agent.instance_slug,
      site_id: agent.site_id, // objet populé avec kiosque_pin
    });
  } catch (err) {
    console.error("Erreur /me agent-portal:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /stats - Statistiques de l'agent
router.get("/stats", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefixeMois = `${year}-${month}`;

    // Point de départ : max(1er du mois, date création agent)
    const debutMois = new Date(year, now.getMonth(), 1);
    const agentCreatedAt = new Date(agent.createdAt || debutMois);
    const debutCalcDate =
      agentCreatedAt > debutMois ? agentCreatedAt : debutMois;

    // Tous les pointages du mois
    const pointagesMois = await Pointage.find({
      agent_id: agent._id,
      date: { $regex: `^${prefixeMois}` },
    }).lean();

    // Index par date pour lookup rapide
    const pointagesParDate = {};
    for (const p of pointagesMois) {
      pointagesParDate[p.date] = p;
    }

    // Calculer tous les jours ouvrés depuis debutCalcDate jusqu'à aujourd'hui
    let presencesMois = 0;
    let absencesMois = 0;
    let retardsMois = 0;
    let partielsMois = 0;

    const cursor = new Date(debutCalcDate);
    cursor.setHours(0, 0, 0, 0);
    const todayStr = now.toISOString().slice(0, 10);

    while (cursor <= now) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        // lundi-vendredi seulement
        const dateStr = cursor.toISOString().slice(0, 10);
        const p = pointagesParDate[dateStr];

        if (!p) {
          // Pas de pointage ce jour — absent seulement si jour passé
          if (dateStr < todayStr) absencesMois++;
        } else if (
          p.statut === "present" &&
          p.heure_arrivee &&
          p.heure_depart
        ) {
          presencesMois++;
        } else if (p.statut === "retard" && p.heure_arrivee && p.heure_depart) {
          retardsMois++;
        } else if (
          p.statut === "partiel" ||
          (p.heure_arrivee && !p.heure_depart)
        ) {
          // Arrivée sans départ = partiel = absence justifiable
          if (dateStr < todayStr) {
            partielsMois++;
            absencesMois++;
          }
        } else if (p.statut === "absent") {
          absencesMois++;
        }
        // conge et justifie ne comptent ni présence ni absence
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Congés
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

    // 20 derniers pointages pour historique
    const pointagesRecents = await Pointage.find({ agent_id: agent._id })
      .sort({ date: -1 })
      .limit(20)
      .lean();

    res.json({
      presencesMois,
      absencesMois,
      retardsMois,
      partielsMois,
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

    // Parse dates using midnight to avoid timezone shifts and validate
    const start = new Date(date_debut + "T00:00:00");
    const end = new Date(date_fin + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Format de date invalide" });
    }
    if (end < start) {
      return res
        .status(400)
        .json({ message: "date_fin doit être >= date_debut" });
    }
    // L'agent doit être présent le jour de la demande — le congé ne peut
    // donc pas commencer avant demain (date_debut >= aujourd'hui + 1 jour)
    const demain = new Date();
    demain.setHours(0, 0, 0, 0);
    demain.setDate(demain.getDate() + 1);
    if (start < demain) {
      return res.status(400).json({
        message: "La date de début doit être au minimum demain — vous êtes censé pointer aujourd'hui.",
      });
    }

    // Compter les jours ouvrés (lundi-vendredi) inclus
    let nb_jours = 0;
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);
    while (cursor <= last) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) nb_jours++;
      cursor.setDate(cursor.getDate() + 1);
    }

    const conge = new Conge({
      agent_id: agent._id,
      site_id: agent.site_id,
      date_debut: start,
      date_fin: end,
      nb_jours,
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

<<<<<<< HEAD
=======
// POST /logout — Libère la session côté serveur (session_token → null).
// Indispensable après toute déconnexion volontaire (PIN, bouton "déconnexion"),
// sinon le champ session_token reste actif en base et bloque toute
// reconnexion ultérieure (même depuis le même appareil) avec SESSION_ACTIVE.
router.post("/logout", authenticateAgent, async (req, res) => {
  try {
    await Agent.findByIdAndUpdate(req.agent._id, {
      session_token: null,
      session_device: null,
    });
    res.json({ message: "Session fermée." });
  } catch (err) {
    console.error("Erreur logout agent:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

>>>>>>> 9d39ba4421735024d54a4426359d6f12dd1c5698
// POST /demande-deconnexion — Agent soumet une demande (sans être connecté)
// Route publique (pas de middleware auth) — identifié par matricule
router.post("/demande-deconnexion", async (req, res) => {
  try {
    const { matricule, motif } = req.body;
    const MOTIFS_VALIDES = ["telephone_vole", "telephone_perdu", "telephone_detruit", "autre"];
    if (!matricule || !motif || !MOTIFS_VALIDES.includes(motif)) {
      return res.status(400).json({ message: "Matricule et motif valide requis." });
    }
    const agent = await Agent.findOne({ matricule: matricule.toUpperCase() });
    if (!agent) return res.status(404).json({ message: "Agent non trouvé." });
    if (!agent.session_token) {
      return res.status(400).json({ message: "Aucune session active pour cet agent." });
    }
    if (agent.demande_deconnexion?.statut === "en_attente") {
      return res.status(409).json({ message: "Une demande est déjà en cours de traitement." });
    }
    await Agent.findByIdAndUpdate(agent._id, {
      demande_deconnexion: {
        statut: "en_attente",
        motif,
        date_demande: new Date(),
      },
    });
    res.json({
      message: "Demande envoyée — un administrateur va traiter votre demande.",
      matricule: agent.matricule,
    });
  } catch (err) {
    console.error("Erreur demande-deconnexion:", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
