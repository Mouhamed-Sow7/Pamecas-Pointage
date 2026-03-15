const express = require('express');
const User = require('../models/User');
const Site = require('../models/Site');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET / — Liste tous les users (superadmin) ou users de ses agences (directeur)
router.get('/', authorizeRoles('superadmin', 'directeur_regional'), async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'directeur_regional') {
      filter = { site_id: { $in: req.user.sites_ids } };
    }
    const users = await User.find(filter).populate('site_id', 'nom code').select('-password');
    return res.json({ data: users });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur.' });
  }
});

// POST / — Créer un user
router.post('/', authorizeRoles('superadmin', 'directeur_regional'), async (req, res) => {
  try {
    const { username, password, role, nom_complet, site_id, sites_ids } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ message: 'username, password et role obligatoires.' });
    }

    // Directeur régional ne peut créer que admin/pointeur pour ses agences
    if (req.user.role === 'directeur_regional') {
      if (!['admin', 'pointeur'].includes(role)) {
        return res.status(403).json({ message: 'Vous pouvez créer uniquement admin ou pointeur.' });
      }
      if (site_id && !req.user.sites_ids.includes(site_id)) {
        return res.status(403).json({ message: 'Agence hors de votre périmètre.' });
      }
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.status(400).json({ message: "Nom d'utilisateur déjà pris." });

    const user = new User({
      username: username.toLowerCase(),
      password,
      role,
      nom_complet,
      site_id: site_id || null,
      sites_ids: sites_ids || [],
      actif: true
    });
    await user.save();

    return res.status(201).json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur création.' });
  }
});

// PUT /:id — Modifier un user
router.put('/:id', authorizeRoles('superadmin', 'directeur_regional'), async (req, res) => {
  try {
    const { nom_complet, role, site_id, sites_ids, actif, password } = req.body;
    const updates = {};
    if (nom_complet) updates.nom_complet = nom_complet;
    if (role) updates.role = role;
    if (site_id !== undefined) updates.site_id = site_id;
    if (sites_ids) updates.sites_ids = sites_ids;
    if (actif !== undefined) updates.actif = actif;

    if (password) {
      // Laisser le pre-save hook hasher
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User non trouvé.' });
      user.password = password;
      Object.assign(user, updates);
      await user.save();
      return res.json(user);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User non trouvé.' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur modification.' });
  }
});

// DELETE /:id — Désactiver un user (pas supprimer)
router.delete('/:id', authorizeRoles('superadmin'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { actif: false });
    return res.json({ message: 'User désactivé.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur.' });
  }
});

module.exports = router;
