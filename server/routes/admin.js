const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Site = require("../models/Site");
const Pointage = require("../models/Pointage");

// Middleware d'authentification admin
const authAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token requis" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    const user = await User.findById(decoded.id);

    if (!user || user.role !== "superadmin") {
      return res
        .status(403)
        .json({ message: "Accès réservé aux administrateurs" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token invalide" });
  }
};

// =========================================
// Dashboard
// =========================================

// GET /api/admin/dashboard - Statistiques globales
router.get("/dashboard", authAdmin, async (req, res) => {
  try {
    const tenants = await Tenant.find();
    const totalTenants = tenants.length;
    const tenantsActifs = tenants.filter((t) => t.statut === "actif").length;
    const tenantsTrial = tenants.filter((t) => t.statut === "trial").length;
    const tenantsSuspendus = tenants.filter(
      (t) => t.statut === "suspendu",
    ).length;

    // Calculer le nombre total d'agents et pointages
    let totalAgents = 0;
    let totalPointages = 0;
    let revenusMensuels = 0;

    for (const tenant of tenants) {
      if (tenant.statut === "actif") {
        revenusMensuels += tenant.getRevenuMensuel();
      }
      totalAgents += tenant.stats?.nb_agents || 0;
      totalPointages += tenant.stats?.nb_pointages_mois || 0;
    }

    res.json({
      totalTenants,
      tenantsActifs,
      tenantsTrial,
      tenantsSuspendus,
      totalAgents,
      totalPointages,
      revenusMensuels,
      tenants: tenants.map((t) => ({
        _id: t._id,
        nom: t.nom,
        slug: t.slug,
        plan: t.plan,
        statut: t.statut,
        nb_sites: t.nb_sites,
        revenuMensuel: t.getRevenuMensuel(),
      })),
    });
  } catch (error) {
    console.error("Erreur dashboard:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// =========================================
// Gestion des clients (Tenants)
// =========================================

// GET /api/admin/tenants - Liste tous les clients
router.get("/tenants", authAdmin, async (req, res) => {
  try {
    const { statut, plan, search } = req.query;

    let query = {};
    if (statut) query.statut = statut;
    if (plan) query.plan = plan;
    if (search) {
      query.$or = [
        { nom: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    const tenants = await Tenant.find(query).sort({ date_creation: -1 });
    res.json(tenants);
  } catch (error) {
    console.error("Erreur liste tenants:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /api/admin/tenants/:id - Détails d'un client
router.get("/tenants/:id", authAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ message: "Client non trouvé" });
    }

    // Récupérer les sites associés
    const sites = await Site.find({ tenant: tenant._id });

    // Récupérer les stats réelles
    const nbAgents = await User.countDocuments({
      tenant: tenant._id,
      role: "agent",
    });

    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);

    const nbPointagesMois = await Pointage.countDocuments({
      tenant: tenant._id,
      date: { $gte: debutMois },
    });

    res.json({
      tenant,
      sites,
      statsReelles: {
        nbAgents,
        nbPointagesMois,
      },
    });
  } catch (error) {
    console.error("Erreur détail tenant:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /api/admin/tenants - Créer un nouveau client
router.post("/tenants", authAdmin, async (req, res) => {
  try {
    const { nom, slug, plan, email, telephone, nomContact, nb_sites } =
      req.body;

    // Vérifier si le slug existe déjà
    const existingTenant = await Tenant.findOne({ slug });
    if (existingTenant) {
      return res.status(400).json({ message: "Ce slug est déjà utilisé" });
    }

    // Créer le tenant
    const tenant = new Tenant({
      nom,
      slug,
      url: `https://${slug}.smartpointage.sn`,
      plan: plan || "pro",
      statut: "trial",
      date_fin_trial: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
      nb_sites: nb_sites || 1,
      contact: {
        nom: nomContact,
        email,
        telephone,
      },
      notes: `Client créé le ${new Date().toLocaleDateString("fr-FR")}`,
    });

    await tenant.save();

    // TODO: Envoyer email de bienvenue avec identifiants
    res.status(201).json({
      message: "Client créé avec succès",
      tenant,
    });
  } catch (error) {
    console.error("Erreur création tenant:", error);
    res.status(500).json({ message: "Erreur lors de la création" });
  }
});

// PUT /api/admin/tenants/:id - Modifier un client
router.put("/tenants/:id", authAdmin, async (req, res) => {
  try {
    const updates = req.body;
    delete updates._id; // Ne pas modifier l'ID

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!tenant) {
      return res.status(404).json({ message: "Client non trouvé" });
    }

    res.json({ message: "Client mis à jour", tenant });
  } catch (error) {
    console.error("Erreur mise à jour tenant:", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour" });
  }
});

// PUT /api/admin/tenants/:id/activer - Activer un client
router.put("/tenants/:id/activer", authAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ message: "Client non trouvé" });
    }

    await tenant.activer();
    res.json({ message: "Client activé", tenant });
  } catch (error) {
    console.error("Erreur activation tenant:", error);
    res.status(500).json({ message: "Erreur lors de l'activation" });
  }
});

// PUT /api/admin/tenants/:id/suspendre - Suspendre un client
router.put("/tenants/:id/suspendre", authAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ message: "Client non trouvé" });
    }

    await tenant.suspendre();
    res.json({ message: "Client suspendu", tenant });
  } catch (error) {
    console.error("Erreur suspension tenant:", error);
    res.status(500).json({ message: "Erreur lors de la suspension" });
  }
});

// =========================================
// Facturation
// =========================================

// GET /api/admin/facturation - Historique des paiements
router.get("/facturation", authAdmin, async (req, res) => {
  try {
    const tenants = await Tenant.find({ statut: "actif" }).select(
      "nom slug plan nb_sites paiements date_prochaine_facturation",
    );

    const factures = [];
    tenants.forEach((tenant) => {
      const revenuMensuel = tenant.getRevenuMensuel();
      factures.push({
        tenant: tenant._id,
        nom: tenant.nom,
        plan: tenant.plan,
        nb_sites: tenant.nb_sites,
        montant: revenuMensuel,
        prochaine_facturation: tenant.date_prochaine_facturation,
        paiements: tenant.paiements,
      });
    });

    res.json(factures);
  } catch (error) {
    console.error("Erreur facturation:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /api/admin/facturation/:tenantId - Enregistrer un paiement
router.post("/facturation/:tenantId", authAdmin, async (req, res) => {
  try {
    const { montant, reference, date } = req.body;

    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Client non trouvé" });
    }

    tenant.paiements.push({
      date: date || new Date(),
      montant,
      reference,
      statut: "effectue",
    });

    // Mettre à jour la prochaine facturation (1 mois plus tard)
    const prochaineDate = new Date();
    prochaineDate.setMonth(prochaineDate.getMonth() + 1);
    tenant.date_prochaine_facturation = prochaineDate;

    await tenant.save();

    res.json({ message: "Paiement enregistré", tenant });
  } catch (error) {
    console.error("Erreur enregistrement paiement:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /api/admin/facturation/export - Export comptable
router.get("/facturation/export", authAdmin, async (req, res) => {
  try {
    const { mois, annee } = req.query;

    const tenants = await Tenant.find({ statut: "actif" });

    const exportData = tenants.map((tenant) => ({
      Client: tenant.nom,
      Plan: tenant.plan.toUpperCase(),
      "Nombre de sites": tenant.nb_sites,
      "Montant mensuel (FCFA)": tenant.getRevenuMensuel(),
      "Prochaine facturation":
        tenant.date_prochaine_facturation?.toLocaleDateString("fr-FR") || "N/A",
      Email: tenant.contact.email,
    }));

    res.json(exportData);
  } catch (error) {
    console.error("Erreur export:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
