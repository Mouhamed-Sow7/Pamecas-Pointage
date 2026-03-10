// server/routes/pointages.js
const express = require('express');
const mongoose = require('mongoose');

const Pointage = require('../models/Pointage');
const { authenticate, authorizeRoles, tenantFilter } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(tenantFilter);

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// ─── POST / — Enregistrer arrivée ou départ ──────────────────────
router.post('/', async (req, res) => {
  try {
    const { agent_id, site_id, methode, type, note } = req.body || {};

    if (!agent_id || !site_id) {
      return res.status(400).json({ message: 'agent_id et site_id sont obligatoires.' });
    }

    // Multi-tenant : un pointeur/admin ne peut pointer que pour son agence
    if (req.user.role !== 'superadmin' && req.user.site_id && req.user.site_id !== site_id.toString()) {
      return res.status(403).json({ message: 'Vous ne pouvez pointer que pour votre agence.' });
    }

    const dateStr = todayString();
    const heure = new Date().toTimeString().slice(0, 5);

    let pointage = await Pointage.findOne({ agent_id, site_id, date: dateStr });

    if (!pointage) {
      // ─── Première action du jour = arrivée ───────────────────
      if (type === 'depart') {
        return res.status(400).json({ message: 'Impossible d\'enregistrer un départ sans arrivée préalable.' });
      }
      pointage = new Pointage({
        agent_id,
        site_id,
        date: dateStr,
        heure_arrivee: heure,
        statut: 'present',
        methode: methode || 'manuel',
        note: note || '',
        superviseur_id: req.user.id,
        sync_status: 'synced',
        synced_at: new Date()
      });
    } else {
      // ─── Pointage existant ────────────────────────────────────
      if (type === 'depart') {
        if (pointage.heure_depart) {
          return res.status(400).json({ message: 'Départ déjà enregistré pour cet agent aujourd\'hui.' });
        }
        pointage.heure_depart = heure;
        // Calcul durée en minutes
        if (pointage.heure_arrivee) {
          const [h1, m1] = pointage.heure_arrivee.split(':').map(Number);
          const [h2, m2] = heure.split(':').map(Number);
          pointage.duree_minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
        }
      } else {
        // Tentative d'arrivée en double
        return res.status(400).json({ message: 'Arrivée déjà enregistrée pour cet agent aujourd\'hui.' });
      }
      pointage.sync_status = 'synced';
      pointage.synced_at = new Date();
    }

    await pointage.save();

    // Notifier via Socket.io
    const io = req.app.get('io');
    if (io && pointage.site_id) {
      io.to(`site:${pointage.site_id}`).emit('pointage:update', pointage);
    }

    return res.status(201).json(pointage);
  } catch (err) {
    console.error('Erreur pointage:', err);
    return res.status(500).json({ message: 'Erreur lors de l\'enregistrement.' });
  }
});

// ─── POST /sync — Sync offline ───────────────────────────────────
router.post('/sync', async (req, res) => {
  try {
    const { pointages } = req.body || {};
    if (!Array.isArray(pointages) || !pointages.length) {
      return res.status(400).json({ message: 'Aucun pointage à synchroniser.' });
    }

    const syncedLocalIds = [];

    for (const p of pointages) {
      try {
        const dateStr = p.date || todayString();
        const filter = { agent_id: p.agent_id, site_id: p.site_id, date: dateStr };
        let pointage = await Pointage.findOne(filter);

        if (!pointage) {
          pointage = new Pointage({
            ...filter,
            local_id: p.local_id,
            heure_arrivee: p.heure_arrivee,
            heure_depart: p.heure_depart,
            statut: p.statut || 'present',
            methode: p.methode || 'qr_code',
            note: p.note || '',
            superviseur_id: req.user.id,
            sync_status: 'synced',
            synced_at: new Date()
          });
        } else {
          if (p.heure_depart && !pointage.heure_depart) {
            pointage.heure_depart = p.heure_depart;
            if (pointage.heure_arrivee) {
              const [h1, m1] = pointage.heure_arrivee.split(':').map(Number);
              const [h2, m2] = p.heure_depart.split(':').map(Number);
              pointage.duree_minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
            }
          }
          pointage.sync_status = 'synced';
          pointage.synced_at = new Date();
        }

        await pointage.save();
        if (p.local_id) syncedLocalIds.push(p.local_id);
      } catch (e) {
        console.error('Erreur sync pointage individuel:', e);
      }
    }

    return res.json({ message: 'Synchronisation terminée.', synced: syncedLocalIds });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur lors de la synchronisation.' });
  }
});

// ─── GET / — Liste des pointages (filtrée par tenant) ────────────
router.get('/', async (req, res) => {
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
      .populate('agent_id', 'nom prenom matricule type_contrat')
      .populate('site_id', 'nom code')
      .sort({ 'agent_id.nom': 1 }); // tri alphabétique par nom

    return res.json({ data: list });
  } catch (err) {
    console.error('Erreur GET pointages:', err);
    return res.status(500).json({ message: 'Erreur lors de la récupération.' });
  }
});

// ─── GET /stats ──────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { site_id, date } = req.query;
    const dateStr = date || todayString();

    const filter = { ...req.siteFilter, date: dateStr };
    if (site_id && mongoose.Types.ObjectId.isValid(site_id)) filter.site_id = site_id;

    const [total, presents, absents, retards] = await Promise.all([
      Pointage.countDocuments(filter),
      Pointage.countDocuments({ ...filter, statut: 'present' }),
      Pointage.countDocuments({ ...filter, statut: 'absent' }),
      Pointage.countDocuments({ ...filter, statut: 'retard' })
    ]);

    return res.json({
      total, presents, absents, retards,
      taux_presence: total > 0 ? Math.round((presents / total) * 100) : 0
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur stats.' });
  }
});

// ─── PUT /:id — Modifier statut/note (admin+ seulement) ──────────
router.put('/:id', authorizeRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const { statut, note, heure_arrivee, heure_depart } = req.body || {};
    const updates = {};

    if (statut) updates.statut = statut;
    if (typeof note === 'string') updates.note = note;
    if (heure_arrivee) updates.heure_arrivee = heure_arrivee;
    if (heure_depart) {
      updates.heure_depart = heure_depart;
      // Recalculer durée si arrivée connue
      const pointage = await Pointage.findById(req.params.id);
      if (pointage?.heure_arrivee) {
        const [h1, m1] = pointage.heure_arrivee.split(':').map(Number);
        const [h2, m2] = heure_depart.split(':').map(Number);
        updates.duree_minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour.' });
    }

    // Multi-tenant : admin ne peut modifier que les pointages de son agence
    const pointage = await Pointage.findById(req.params.id);
    if (!pointage) return res.status(404).json({ message: 'Pointage non trouvé.' });

    if (req.user.role !== 'superadmin' && pointage.site_id?.toString() !== req.user.site_id) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    const updated = await Pointage.findByIdAndUpdate(req.params.id, updates, { new: true });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur lors de la mise à jour.' });
  }
});

module.exports = router;