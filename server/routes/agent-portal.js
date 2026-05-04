const express = require("express");
const router = express.Router();

router.get("/test", (req, res) => res.json({ message: "test" }));

module.exports = router;

// ── Middleware auth portail agent ─────────────────────────────
async function authenticateAgent(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Token manquant." });

    const secret = process.env.JWT_SECRET || "change-me";
    const payload = jwt.verify(token, secret);

    if (payload.type !== "agent") {
      return res.status(401).json({ message: "Token invalide." });
    }

    const agent = await Agent.findById(payload.agent_id).populate(
      "site_id",
      "nom code config",
    );

    if (!agent || agent.statut !== "actif") {
      return res.status(401).json({ message: "Agent inactif ou introuvable." });
    }

    req.agent = agent;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalide ou expiré." });
  }
}

// ── POST /login ───────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { identifiant, password } = req.body;
    if (!identifiant || !password) {
      return res
        .status(400)
        .json({ message: "Identifiant et mot de passe requis." });
    }

    // Chercher par matricule ou téléphone
    const agent = await Agent.findOne({
      $or: [
        { matricule: identifiant.toUpperCase() },
        { telephone: identifiant },
      ],
      statut: "actif",
    }).populate("site_id", "nom code");

    if (!agent) {
      return res.status(401).json({ message: "Agent introuvable." });
    }

    // Vérifier mot de passe
    if (!agent.password_hash) {
      return res
        .status(401)
        .json({ message: "Compte non activé. Contactez votre responsable." });
    }

    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Mot de passe incorrect." });
    }

    // Générer token agent (type différent du token admin)
    const secret = process.env.JWT_SECRET || "change-me";
    const token = jwt.sign(
      { type: "agent", agent_id: agent._id.toString() },
      secret,
      { expiresIn: "30d" }, // Token longue durée pour les agents
    );

    return res.json({
      token,
      agent: {
        _id: agent._id,
        nom: agent.nom,
        prenom: agent.prenom,
        matricule: agent.matricule,
        poste: agent.poste,
        type_contrat: agent.type_contrat,
        site_nom: agent.site_id?.nom,
        totp_enabled: agent.totp_enabled,
        totp_secret: agent.totp_secret, // nécessaire pour générer QR côté client
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Erreur connexion." });
  }
});

// ── GET /stats ────────────────────────────────────────────────
router.get("/stats", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const now = new Date();
    const debutMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const finMois = now.toISOString().slice(0, 10);

    // Stats du mois courant
    const pointagesMois = await Pointage.find({
      agent_id: agent._id,
      date: { $gte: debutMois, $lte: finMois },
    }).sort({ date: -1 });

    const presents = pointagesMois.filter((p) => p.statut === "present").length;
    const absents = pointagesMois.filter((p) => p.statut === "absent").length;
    const retards = pointagesMois.filter((p) => p.statut === "retard").length;

    // Historique 30 derniers jours
    const historique = pointagesMois.slice(0, 30).map((p) => ({
      date: p.date,
      statut: p.statut,
      heure_arrivee: p.heure_arrivee,
      heure_depart: p.heure_depart,
    }));

    return res.json({ presents, absents, retards, historique });
  } catch (err) {
    return res.status(500).json({ message: "Erreur stats." });
  }
});

// ── GET /conges ───────────────────────────────────────────────
router.get("/conges", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const annee = new Date().getFullYear();

    // Demandes de congé de l'agent
    const demandes = await Conge.find({
      agent_id: agent._id,
    })
      .sort({ createdAt: -1 })
      .limit(20);

    // Calcul solde
    // Règle : 2.5 jours acquis par mois travaillé (standard Sénégal)
    const moisTravailles = Math.min(new Date().getMonth() + 1, 12);
    const jours_acquis = Math.floor(moisTravailles * 2.5);

    // Jours pris (approuvés cette année)
    const joursApprouves = await Conge.aggregate([
      {
        $match: {
          agent_id: agent._id,
          statut: "approuve",
          date_debut: { $gte: `${annee}-01-01` },
        },
      },
      { $group: { _id: null, total: { $sum: "$nb_jours" } } },
    ]);
    const jours_pris = joursApprouves[0]?.total || 0;

    // Jours en attente
    const joursEnAttente = await Conge.aggregate([
      {
        $match: {
          agent_id: agent._id,
          statut: "en_attente",
          date_debut: { $gte: `${annee}-01-01` },
        },
      },
      { $group: { _id: null, total: { $sum: "$nb_jours" } } },
    ]);
    const jours_en_attente = joursEnAttente[0]?.total || 0;

    const solde_disponible = Math.max(
      0,
      jours_acquis - jours_pris - jours_en_attente,
    );

    return res.json({
      jours_acquis,
      jours_pris,
      jours_en_attente,
      solde_disponible,
      demandes: demandes.map((d) => ({
        _id: d._id,
        date_debut: d.date_debut,
        date_fin: d.date_fin,
        nb_jours: d.nb_jours,
        type: d.type,
        motif: d.motif,
        statut: d.statut,
        commentaire_rh: d.commentaire_rh,
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: "Erreur congés." });
  }
});

// ── POST /conges ──────────────────────────────────────────────
router.post("/conges", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const { date_debut, date_fin, type, motif, nb_jours } = req.body;

    if (!date_debut || !date_fin || !nb_jours) {
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
