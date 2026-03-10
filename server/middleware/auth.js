// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Authentification JWT ────────────────────────────────────────
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Token manquant.' });
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
      site_nom: user.site_id?.nom || null
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