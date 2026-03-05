const express = require('express');
const mongoose = require('mongoose');

const Pointage = require('../models/Pointage');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

function todayString() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

router.post('/', async (req, res) => {
  try {
    const { agent_id, site_id, statut, methode, note } = req.body || {};

    if (!agent_id || !site_id) {
      return res.status(400).json({
        message: "Les champs agent_id et site_id sont obligatoires."
      });
    }

    const dateStr = todayString();
    const heure = new Date().toTimeString().slice(0, 5);

    let pointage = await Pointage.findOne({
      agent_id,
      site_id,
      date: dateStr
    });

    if (!pointage) {
      pointage = new Pointage({
        agent_id,
        site_id,
        date: dateStr,
        heure_arrivee: heure,
        statut: statut || 'present',
        methode: methode || 'qr_code',
        note: note || '',
        superviseur_id: req.user && req.user.id ? req.user.id : undefined,
        sync_status: 'synced',
        synced_at: new Date()
      });
    } else {
      pointage.statut = statut || pointage.statut;
      pointage.methode = methode || pointage.methode;
      pointage.note = note || pointage.note;
      if (!pointage.heure_arrivee) {
        pointage.heure_arrivee = heure;
      }
      pointage.sync_status = 'synced';
      pointage.synced_at = new Date();
    }

    await pointage.save();

    return res.status(201).json(pointage);
  } catch (err) {
    console.error("Erreur lors de l'enregistrement du pointage:", err);
    return res.status(500).json({
      message: "Erreur lors de l'enregistrement du pointage."
    });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { pointages } = req.body || {};
    if (!Array.isArray(pointages) || !pointages.length) {
      return res
        .status(400)
        .json({ message: 'Aucun pointage à synchroniser.' });
    }

    const syncedLocalIds = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const p of pointages) {
      try {
        const dateStr = p.date || todayString();
        const filter = {
          agent_id: p.agent_id,
          site_id: p.site_id,
          date: dateStr
        };

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
            superviseur_id: req.user && req.user.id ? req.user.id : undefined,
            sync_status: 'synced',
            synced_at: new Date()
          });
        } else {
          pointage.heure_arrivee = p.heure_arrivee || pointage.heure_arrivee;
          pointage.heure_depart = p.heure_depart || pointage.heure_depart;
          pointage.statut = p.statut || pointage.statut;
          pointage.methode = p.methode || pointage.methode;
          pointage.note = p.note || pointage.note;
          pointage.sync_status = 'synced';
          pointage.synced_at = new Date();
        }

        await pointage.save();
        if (p.local_id) {
          syncedLocalIds.push(p.local_id);
        }
      } catch (e) {
        // On continue malgré les erreurs individuelles pour les autres enregistrements
        // eslint-disable-next-line no-console
        console.error('Erreur sur un pointage en sync:', e);
      }
    }

    return res.json({
      message: 'Synchronisation terminée.',
      synced: syncedLocalIds
    });
  } catch (err) {
    console.error('Erreur lors de la synchronisation des pointages:', err);
    return res.status(500).json({
      message: 'Erreur lors de la synchronisation des pointages.'
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { site_id, date } = req.query;
    const dateStr = date || todayString();

    const query = { date: dateStr };
    if (site_id && mongoose.Types.ObjectId.isValid(site_id)) {
      query.site_id = site_id;
    }

    const list = await Pointage.find(query)
      .populate('agent_id', 'nom prenom matricule')
      .populate('site_id', 'nom code')
      .sort({ createdAt: -1 });

    return res.json({ data: list });
  } catch (err) {
    console.error('Erreur lors de la récupération des pointages:', err);
    return res.status(500).json({
      message: 'Erreur lors de la récupération des pointages.'
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { site_id, date } = req.query;
    const dateStr = date || todayString();

    const filter = { date: dateStr };
    if (site_id && mongoose.Types.ObjectId.isValid(site_id)) {
      filter.site_id = site_id;
    }

    const [total, presents, absents, retards] = await Promise.all([
      Pointage.countDocuments(filter),
      Pointage.countDocuments({ ...filter, statut: 'present' }),
      Pointage.countDocuments({ ...filter, statut: 'absent' }),
      Pointage.countDocuments({ ...filter, statut: 'retard' })
    ]);

    const taux_presence =
      total > 0 ? Math.round((presents / total) * 100) : 0;

    return res.json({
      total,
      presents,
      absents,
      retards,
      taux_presence
    });
  } catch (err) {
    console.error('Erreur lors du calcul des statistiques de pointage:', err);
    return res.status(500).json({
      message: 'Erreur lors du calcul des statistiques de pointage.'
    });
  }
});

router.put(
  '/:id',
  authorizeRoles('superviseur', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { statut, note } = req.body || {};

      const updates = {};
      if (statut) updates.statut = statut;
      if (typeof note === 'string') updates.note = note;

      if (!Object.keys(updates).length) {
        return res.status(400).json({
          message: 'Aucune donnée à mettre à jour.'
        });
      }

      const pointage = await Pointage.findByIdAndUpdate(id, updates, {
        new: true
      });

      if (!pointage) {
        return res.status(404).json({ message: 'Pointage non trouvé.' });
      }

      return res.json(pointage);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du pointage:', err);
      return res.status(500).json({
        message: 'Erreur lors de la mise à jour du pointage.'
      });
    }
  }
);

module.exports = router;

