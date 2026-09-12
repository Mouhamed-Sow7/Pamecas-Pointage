const express = require("express");
const router = express.Router();

const { authenticate, authorizeRoles } = require("../middleware/auth");
const Tenant = require("../models/Tenant");
const Agent = require("../models/Agent");
const paydunya = require("../services/paydunya");

// ─── Webhook PayDunya — PUBLIC, doit rester AVANT router.use(authenticate) ──
// C'est PayDunya qui appelle cette route directement, pas un utilisateur
// connecté. La sécurité vient de la vérification du hash + de la
// re-confirmation serveur-à-serveur ci-dessous, pas d'un token JWT.
router.post("/webhook/paydunya", async (req, res) => {
  try {
    const data = req.body?.data || req.body;
    const hashRecu = data?.hash;

    if (!hashRecu || !paydunya.verifierHashIpn(hashRecu)) {
      console.warn("[PayDunya IPN] hash invalide, requête rejetée.");
      return res.status(401).json({ message: "Hash invalide." });
    }

    const token = data.invoice?.token || data.token;
    if (!token) {
      return res.status(400).json({ message: "Token de facture manquant." });
    }

    // Re-confirmation serveur-à-serveur : le hash PayDunya est un hash
    // statique de notre clé (pas un HMAC du contenu de la requête), donc
    // on ne fait jamais confiance au seul corps de l'IPN pour débloquer
    // un abonnement — on revérifie directement auprès de PayDunya.
    const confirmation = await paydunya.confirmerFacture(token);
    const statutFinal = confirmation?.invoice?.status || confirmation?.status;

    if (statutFinal !== "completed") {
      console.log(
        `[PayDunya IPN] facture ${token} statut="${statutFinal}", ignorée.`,
      );
      return res.json({ message: "Reçu, statut non completed, ignoré." });
    }

    const customData = data.custom_data || confirmation.custom_data || {};
    const tenantSlug = customData.tenant_slug;
    const planVise = customData.plan_vise;

    if (!tenantSlug || !planVise) {
      console.error(
        `[PayDunya IPN] facture ${token} confirmée mais custom_data manquant — traitement manuel nécessaire.`,
      );
      return res.status(200).json({ message: "custom_data manquant." });
    }

    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      console.error(
        `[PayDunya IPN] tenant "${tenantSlug}" introuvable pour la facture ${token}.`,
      );
      return res.status(200).json({ message: "Tenant introuvable." });
    }

    // Idempotence : un même paiement ne doit jamais étendre l'abonnement
    // deux fois (PayDunya peut renvoyer le même IPN plusieurs fois).
    if (tenant.abonnement?.dernier_paiement?.token === token) {
      return res.json({ message: "Déjà traité." });
    }

    const montant = Number(
      data.invoice?.total_amount || confirmation.invoice?.total_amount || 0,
    );
    const dateExpiration = new Date();
    dateExpiration.setMonth(dateExpiration.getMonth() + 1);

    tenant.plan = planVise;
    tenant.statut = "actif";
    tenant.abonnement = tenant.abonnement || {};
    tenant.abonnement.date_expiration = dateExpiration;
    tenant.abonnement.dernier_paiement = {
      token,
      montant,
      methode: data.customer?.payment_method || null,
      date: new Date(),
    };
    tenant.abonnement.facture_en_attente = {
      token: null,
      montant: null,
      plan_vise: null,
      cree_le: null,
    };
    await tenant.save();

    console.log(
      `[PayDunya IPN] tenant "${tenantSlug}" -> plan ${planVise}, actif jusqu'au ${dateExpiration.toISOString()}.`,
    );
    return res.json({ message: "OK" });
  } catch (err) {
    console.error("Erreur webhook PayDunya:", err);
    // On répond 200 même en erreur interne pour éviter que PayDunya ne
    // martèle de retries sur une erreur qui ne se résoudra pas toute seule ;
    // l'erreur reste tracée côté logs pour investigation manuelle.
    return res.status(200).json({ message: "Erreur interne, voir logs." });
  }
});

// ─── Tout ce qui suit nécessite d'être connecté ──────────────────
router.use(authenticate);

// GET /api/billing/status — état d'abonnement du tenant courant
router.get(
  "/status",
  authorizeRoles("admin", "directeur_regional", "superadmin"),
  async (req, res) => {
    try {
      const slug = req.user.instance_slug;
      if (!slug) {
        return res.status(400).json({
          message: "Compte plateforme (multi-instances) — aucun abonnement associé.",
        });
      }
      const tenant = await Tenant.findOne({ slug });
      if (!tenant) {
        return res.status(404).json({ message: "Tenant introuvable." });
      }
      const nbAgents = await Agent.countDocuments({
        instance_slug: slug,
        statut: "actif",
      });
      const prixParAgent =
        Tenant.PRIX_PAR_AGENT[tenant.plan] || Tenant.PRIX_PAR_AGENT.standard;

      return res.json({
        plan: tenant.plan,
        statut: tenant.statut,
        date_expiration: tenant.abonnement?.date_expiration || null,
        nb_agents: nbAgents,
        prix_par_agent: prixParAgent,
        montant_mensuel: nbAgents * prixParAgent,
        prix_grille: Tenant.PRIX_PAR_AGENT,
        facture_en_attente: tenant.abonnement?.facture_en_attente?.token
          ? {
              token: tenant.abonnement.facture_en_attente.token,
              montant: tenant.abonnement.facture_en_attente.montant,
              plan_vise: tenant.abonnement.facture_en_attente.plan_vise,
            }
          : null,
      });
    } catch (err) {
      console.error("Erreur billing/status:", err);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// POST /api/billing/upgrade { plan: 'standard' | 'pro' }
// Calcule le montant (nb agents actifs x prix du plan), crée la facture
// PayDunya, renvoie l'URL de paiement vers laquelle rediriger le client.
router.post(
  "/upgrade",
  authorizeRoles("admin", "directeur_regional", "superadmin"),
  async (req, res) => {
    try {
      const slug = req.user.instance_slug;
      if (!slug) {
        return res.status(400).json({
          message: "Compte plateforme (multi-instances) — aucun abonnement associé.",
        });
      }
      const { plan } = req.body || {};
      if (!Tenant.PRIX_PAR_AGENT[plan]) {
        return res.status(400).json({ message: "Plan invalide." });
      }

      const tenant = await Tenant.findOne({ slug });
      if (!tenant) {
        return res.status(404).json({ message: "Tenant introuvable." });
      }

      const nbAgents = await Agent.countDocuments({
        instance_slug: slug,
        statut: "actif",
      });
      if (nbAgents === 0) {
        return res
          .status(400)
          .json({ message: "Aucun agent actif — rien à facturer." });
      }

      const prixParAgent = Tenant.PRIX_PAR_AGENT[plan];
      const montant = nbAgents * prixParAgent;
      const appUrl = process.env.APP_URL || "https://smartpointage.digitalesf.com";

      const { token, checkoutUrl, mode } = await paydunya.creerFacture({
        montant,
        description: `SmartPointage - Abonnement ${plan} (${nbAgents} agents x ${prixParAgent} FCFA) - ${tenant.nom}`,
        customData: { tenant_slug: slug, plan_vise: plan },
        callbackUrl: `${appUrl}/api/billing/webhook/paydunya`,
        returnUrl: `${appUrl}/dashboard?paiement=en_cours`,
      });

      tenant.abonnement = tenant.abonnement || {};
      tenant.abonnement.facture_en_attente = {
        token,
        montant,
        plan_vise: plan,
        cree_le: new Date(),
      };
      await tenant.save();

      return res.json({ checkout_url: checkoutUrl, token, montant, mode });
    } catch (err) {
      console.error("Erreur billing/upgrade:", err);
      return res
        .status(500)
        .json({ message: err.message || "Erreur lors de la création du paiement." });
    }
  },
);

module.exports = router;
