const express = require('express');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function createTokenPayload(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    role: user.role,
    site_id: user.site_id || null
  };
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Nom d'utilisateur et mot de passe requis." });
    }

    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      return res
        .status(401)
        .json({ message: 'Identifiants invalides. Veuillez réessayer.' });
    }

    if (!user.actif) {
      return res
        .status(403)
        .json({ message: "Ce compte est désactivé. Contactez l'administrateur." });
    }

    const isValid = await user.verifyPassword(password);

    if (!isValid) {
      return res
        .status(401)
        .json({ message: 'Identifiants invalides. Veuillez réessayer.' });
    }

    user.derniere_connexion = new Date();
    await user.save();

    const payload = createTokenPayload(user);

    const secret = process.env.JWT_SECRET || 'change-me';
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

    const token = jwt.sign(payload, secret, { expiresIn });

    return res.json({
      token,
      user: payload
    });
  } catch (err) {
    console.error("Erreur lors de la connexion de l'utilisateur:", err);
    return res
      .status(500)
      .json({ message: "Erreur lors de la tentative de connexion." });
  }
});

router.post('/logout', (req, res) => {
  return res.json({ message: 'Déconnecté avec succès' });
});

router.get('/me', authenticate, (req, res) => {
  return res.json(req.user);
});

module.exports = router;

