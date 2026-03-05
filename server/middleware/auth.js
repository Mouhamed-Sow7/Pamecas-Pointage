const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Token manquant. Authentification requise.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me');
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide ou expiré.' });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Accès refusé. Rôle de l'utilisateur introuvable." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès non autorisé pour ce rôle.' });
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authorizeRoles
};

