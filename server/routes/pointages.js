// server/routes/pointages.js
const express = require("express");
const mongoose = require("mongoose");

const Pointage = require("../models/Pointage");
const Agent = require("../models/Agent");
const { validateQRData } = require("../utils/totp");
const {
  authenticate,
  authorizeRoles,
  tenantFilter,
} = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);
router.use(tenantFilter);

// Haversine distance util
function distanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const RAYON_GEOFENCE_METRES = 500;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// ─── POST / — Enregistrer arrivée ou départ ──────────────────────
router.post("/", async (req, res) => {
  try {
    const { agent_id, site_id, methode, type, note } = req.body || {};

    // Géofencing — vérifier position si site a des coordonnées
    const { coordonnees_agent } = req.body || {};
    let horsZone = false;
    let distanceM = null;

    if (coordonnees_agent?.latitude && coordonnees_agent?.longitude) {
      const Site = require("../models/Site");
      const site = await Site.findById(site_id).select("coordonnees");
      if (site?.coordonnees?.latitude && site?.coordonnees?.longitude) {
        distanceM = distanceMetres(
          coordonnees_agent.latitude,
          coordonnees_agent.longitude,
          site.coordonnees.latitude,
          site.coordonnees.longitude,
        );
        if (distanceM > RAYON_GEOFENCE_METRES) {
          horsZone = true;
          return res.status(403).json({
            message: `Hors zone — vous êtes à ${Math.round(distanceM)}m de l'agence (max ${RAYON_GEOFENCE_METRES}m).`,
            hors_zone: true,
            distance_metres: Math.round(distanceM),
          });
        }
      }
    }

    if (!agent_id || !site_id) {
      return res
        .status(400)
        .json({ message: "agent_id et site_id sont obligatoires." });
    }

    // ── Vérification TOTP/QR dynamique ──────────────────────────────
    // Un pointage via scan kiosque (methode=qr_code) DOIT fournir qr_data
    // signé cryptographiquement. Sans ça, n'importe qui connaissant un
    // agent_id pourrait pointer pour un autre agent sans jamais scanner.
    // Le pointage manuel (admin/pointeur via dashboard) reste autorisé
    // sans qr_data — c'est un acte volontaire d'un rôle de confiance.
    const isManualByStaff =
      methode === "manuel" &&
      !req.user.is_kiosque &&
      ["admin", "superadmin", "pointeur", "directeur_regional"].includes(
        req.user.role,
      );

    if (!isManualByStaff) {
      const agentForTotp = await Agent.findById(agent_id).select(
        "matricule totp_enabled totp_secret",
      );
      if (!agentForTotp) {
        return res.status(404).json({ message: "Agent introuvable." });
      }
      if (agentForTotp.totp_enabled && agentForTotp.totp_secret) {
        const { qr_data } = req.body || {};
        if (!qr_data) {
          return res.status(401).json({
            message: "Code QR requis pour ce pointage (TOTP activé pour cet agent).",
          });
        }
        const result = validateQRData(
          qr_data,
          agentForTotp.matricule,
          agentForTotp.totp_secret,
        );
        if (!result.valid) {
          return res.status(401).json({
            message: `QR invalide ou expiré : ${result.reason}`,
          });
        }
      }
      // Si TOTP non activé pour cet agent → rétro-compatibilité QR statique
    }

    // Multi-tenant : un pointeur/admin ne peut pointer que pour son agence
    if (
      req.user.role !== "superadmin" &&
      req.user.site_id &&
      req.user.site_id !== site_id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Vous ne pouvez pointer que pour votre agence." });
    }

    const dateStr = todayString();
    const heure = new Date().toTimeString().slice(0, 5);

    let pointage = await Pointage.findOne({ agent_id, site_id, date: dateStr });

    // Cooldown anti-fraude : 1 minute entre deux scans du même agent
    const maintenant = new Date();
    const uneMinuteAvant = new Date(maintenant.getTime() - 60 * 1000);
    if (
      pointage &&
      pointage.last_scan_at &&
      pointage.last_scan_at > uneMinuteAvant
    ) {
      const resteSecondes = Math.ceil(
        (pointage.last_scan_at - uneMinuteAvant) / 1000,
      );
      return res.status(429).json({
        message: `Scan trop rapide. Attendez ${resteSecondes} seconde(s).`,
        cooldown: true,
        reste_secondes: resteSecondes,
      });
    }

    if (!pointage) {
      // ─── Première action du jour = arrivée ───────────────────
      if (type === "depart") {
        return res
          .status(400)
          .json({
            message:
              "Impossible d'enregistrer un départ sans arrivée préalable.",
          });
      }
      pointage = new Pointage({
        agent_id,
        site_id,
        date: dateStr,
        heure_arrivee: heure,
        statut: "present",
        methode: methode || "manuel",
        note: note || "",
        superviseur_id:
          req.user.is_kiosque || req.user.is_god_mode ? null : req.user.id,
        sync_status: "synced",
        synced_at: new Date(),
        coordonnees_arrivee: coordonnees_agent
          ? {
              latitude: coordonnees_agent.latitude,
              longitude: coordonnees_agent.longitude,
              precision: coordonnees_agent.precision || null,
            }
          : undefined,
      });
    } else {
      // ─── Pointage existant ────────────────────────────────────
      if (type === "depart") {
        if (pointage.heure_depart) {
          return res
            .status(400)
            .json({
              message: "Départ déjà enregistré pour cet agent aujourd'hui.",
            });
        }
        pointage.heure_depart = heure;
        // Calcul durée en minutes
        if (pointage.heure_arrivee) {
          const [h1, m1] = pointage.heure_arrivee.split(":").map(Number);
          const [h2, m2] = heure.split(":").map(Number);
          pointage.duree_minutes = h2 * 60 + m2 - (h1 * 60 + m1);
        }
        if (coordonnees_agent) {
          pointage.coordonnees_depart = {
            latitude: coordonnees_agent.latitude,
            longitude: coordonnees_agent.longitude,
            precision: coordonnees_agent.precision || null,
          };
        }
      } else {
        // Tentative d'arrivée en double
        return res
          .status(400)
          .json({
            message: "Arrivée déjà enregistrée pour cet agent aujourd'hui.",
          });
      }
      pointage.sync_status = "synced";
      pointage.synced_at = new Date();
    }

    pointage.last_scan_at = new Date();
    await pointage.save();

    // Notifier via Socket.io
    const io = req.app.get("io");
    if (io && pointage.site_id) {
      io.to(`site:${pointage.site_id}`).emit("pointage:update", pointage);
    }

    return res.status(201).json(pointage);
  } catch (err) {
    console.error("Erreur pointage:", err);
    return res
      .status(500)
      .json({ message: "Erreur lors de l'enregistrement." });
  }
});

// ─── POST /sync — Sync offline ───────────────────────────────────
router.post("/sync", async (req, res) => {
  try {
    const { pointages } = req.body || {};
    if (!Array.isArray(pointages) || !pointages.length) {
      return res
        .status(400)
        .json({ message: "Aucun pointage à synchroniser." });
    }

    const syncedLocalIds = [];

    for (const p of pointages) {
      try {
        const dateStr = p.date || todayString();
        const filter = {
          agent_id: p.agent_id,
          site_id: p.site_id,
          date: dateStr,
        };
        let pointage = await Pointage.findOne(filter);

        if (!pointage) {
          pointage = new Pointage({
            ...filter,
            local_id: p.local_id,
            heure_arrivee: p.heure_arrivee,
            heure_depart: p.heure_depart,
            statut: p.statut || "present",
            methode: p.methode || "qr_code",
            note: p.note || "",
            superviseur_id:
              req.user.is_kiosque || req.user.is_god_mode ? null : req.user.id,
            sync_status: "synced",
            synced_at: new Date(),
          });
        } else {
          if (p.heure_depart && !pointage.heure_depart) {
            pointage.heure_depart = p.heure_depart;
            if (pointage.heure_arrivee) {
              const [h1, m1] = pointage.heure_arrivee.split(":").map(Number);
              const [h2, m2] = p.heure_depart.split(":").map(Number);
              pointage.duree_minutes = h2 * 60 + m2 - (h1 * 60 + m1);
            }
          }
          pointage.sync_status = "synced";
          pointage.synced_at = new Date();
        }

        await pointage.save();
        if (p.local_id) syncedLocalIds.push(p.local_id);
      } catch (e) {
        console.error("Erreur sync pointage individuel:", e);
      }
    }

    return res.json({
      message: "Synchronisation terminée.",
      synced: syncedLocalIds,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Erreur lors de la synchronisation." });
  }
});

// ─── GET / — Liste des pointages (filtrée par tenant) ────────────
router.get("/", async (req, res) => {
  try {
    const { site_id, date, statut } = req.query;
    const dateStr = date || todayString();

    // Base: filtre tenant (injecté par middleware)
    const query = { ...req.siteFilter, date: dateStr };

    // Superadmin peut filtrer par site spécifique
    if (site_id && mongoose.Types.ObjectId.isValid(site_id)) {
      query.site_id = site_id;
    }

    // Filtre optionnel par statut
    if (statut) query.statut = statut;

    const list = await Pointage.find(query)
      .populate("agent_id", "nom prenom matricule type_contrat")
      .populate("site_id", "nom code")
      .sort({ "agent_id.nom": 1 }); // tri alphabétique par nom

    return res.json({ data: list });
  } catch (err) {
    console.error("Erreur GET pointages:", err);
    return res.status(500).json({ message: "Erreur lors de la récupération." });
  }
});

// ─── GET /stats ──────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const { site_id, date } = req.query;
    const dateStr = date || todayString();

    const filter = { ...req.siteFilter, date: dateStr };
    if (site_id && mongoose.Types.ObjectId.isValid(site_id))
      filter.site_id = site_id;

    const [total, presents, absents, retards] = await Promise.all([
      Pointage.countDocuments(filter),
      Pointage.countDocuments({ ...filter, statut: "present" }),
      Pointage.countDocuments({ ...filter, statut: "absent" }),
      Pointage.countDocuments({ ...filter, statut: "retard" }),
    ]);

    return res.json({
      total,
      presents,
      absents,
      retards,
      taux_presence: total > 0 ? Math.round((presents / total) * 100) : 0,
    });
  } catch (err) {
    return res.status(500).json({ message: "Erreur stats." });
  }
});

// ─── PUT /:id — Modifier statut/note (admin+ seulement) ──────────
router.put("/:id", authorizeRoles("admin", "superadmin"), async (req, res) => {
  try {
    const { statut, note, heure_arrivee, heure_depart } = req.body || {};
    const updates = {};

    if (statut) updates.statut = statut;
    if (typeof note === "string") updates.note = note;
    if (heure_arrivee) updates.heure_arrivee = heure_arrivee;
    if (heure_depart) {
      updates.heure_depart = heure_depart;
      // Recalculer durée si arrivée connue
      const pointage = await Pointage.findById(req.params.id);
      if (pointage?.heure_arrivee) {
        const [h1, m1] = pointage.heure_arrivee.split(":").map(Number);
        const [h2, m2] = heure_depart.split(":").map(Number);
        updates.duree_minutes = h2 * 60 + m2 - (h1 * 60 + m1);
      }
    }

    if (!Object.keys(updates).length) {
      return res
        .status(400)
        .json({ message: "Aucune donnée à mettre à jour." });
    }

    // Multi-tenant : admin ne peut modifier que les pointages de son agence
    const pointage = await Pointage.findById(req.params.id);
    if (!pointage)
      return res.status(404).json({ message: "Pointage non trouvé." });

    if (
      req.user.role !== "superadmin" &&
      pointage.site_id?.toString() !== req.user.site_id
    ) {
      return res.status(403).json({ message: "Accès refusé." });
    }

    const updated = await Pointage.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: "Erreur lors de la mise à jour." });
  }
});

module.exports = router;
