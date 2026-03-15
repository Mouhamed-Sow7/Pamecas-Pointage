// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Site = require('../models/Site');

// ─── Authentification JWT ────────────────────────────────────────
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Token manquant.' });
    }

    // Superadmin Token — accès maître du vendeur SaaS
    if (process.env.SUPERADMIN_TOKEN && token === process.env.SUPERADMIN_TOKEN) {
      req.user = {
        id: 'superadmin_master',
        username: 'smartpointage_admin',
        role: 'superadmin',
        site_id: null,
        site_nom: 'Super Admin',
        sites_ids: [],
        is_superadmin: true
      };
      return next();
    }

    // Vérifier si c'est un token kiosque (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(token)) {
      const site = await Site.findOne({ kiosque_token: token, actif: true });
      if (!site) return res.status(401).json({ message: 'Token kiosque invalide.' });
      req.user = {
        id: `kiosque_${site._id}`,
        username: `kiosque_${site.code}`,
        role: 'pointeur',
        site_id: site._id.toString(),
        site_nom: site.nom,
        sites_ids: [],
        is_kiosque: true
      };
      return next();
    }

    const secret = process.env.JWT_SECRET || 'change-me';
    const payload = jwt.verify(token, secret);

    // Recharger l'user depuis la DB pour avoir site_id à jour
    const user = await User.findById(payload.id).select('-password').populate('site_id', 'nom code _id');
    if (!user || !user.actif) {
      return res.status(401).json({ message: 'Compte inactif ou introuvable.' });
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      site_id: user.site_id?._id?.toString() || user.site_id?.toString() || null,
      site_nom: user.site_id?.nom || null,
      sites_ids: (user.sites_ids || []).map(s => s._id?.toString() || s.toString())
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide ou expiré.' });
  }
}

// ─── Autorisation par rôles ──────────────────────────────────────
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    return next();
  };
}

// ─── Multi-tenant : filtre automatique par site ──────────────────
// Injecte req.siteFilter dans chaque requête selon le rôle
function tenantFilter(req, res, next) {
  if (!req.user) return next();

  if (req.user.role === 'superadmin') {
    // Superadmin voit tout — pas de filtre
    req.siteFilter = {};
  } else if (req.user.role === 'directeur_regional') {
    // Voit toutes ses agences
    req.siteFilter = { site_id: { $in: req.user.sites_ids || [] } };
  } else if (req.user.site_id) {
    // Admin/pointeur/superviseur — filtré sur leur agence
    req.siteFilter = { site_id: req.user.site_id };
  } else {
    // Pas de site assigné — rien visible
    req.siteFilter = { site_id: null };
  }

  return next();
}

module.exports = { authenticate, authorizeRoles, tenantFilter };