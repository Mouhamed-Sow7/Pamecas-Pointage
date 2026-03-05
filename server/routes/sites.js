const express = require('express');

const Site = require('../models/Site');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const sites = await Site.find({ actif: true }).sort({ nom: 1 });
    return res.json({ data: sites });
  } catch (err) {
    console.error('Erreur lors de la récupération des sites:', err);
    return res
      .status(500)
      .json({ message: 'Erreur lors de la récupération des sites.' });
  }
});

router.post(
  '/',
  authorizeRoles('superadmin'),
  async (req, res) => {
    try {
      const site = new Site(req.body);
      await site.save();
      return res.status(201).json(site);
    } catch (err) {
      console.error('Erreur lors de la création du site:', err);
      return res
        .status(500)
        .json({ message: 'Erreur lors de la création du site.' });
    }
  }
);

router.put(
  '/:id',
  authorizeRoles('superadmin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body || {};

      const site = await Site.findByIdAndUpdate(id, updates, {
        new: true
      });

      if (!site) {
        return res.status(404).json({ message: 'Site non trouvé.' });
      }

      return res.json(site);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du site:', err);
      return res
        .status(500)
        .json({ message: 'Erreur lors de la mise à jour du site.' });
    }
  }
);

module.exports = router;

