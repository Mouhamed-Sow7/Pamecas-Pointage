const express = require('express');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Site = require('../models/Site');
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

// Valider token kiosque (pas besoin de JWT)
router.get('/kiosque/:token', async (req, res) => {
  try {
    const site = await Site.findOne({ kiosque_token: req.params.token, actif: true }).select('_id nom code');
    if (!site) return res.status(401).json({ message: 'Token kiosque invalide.' });
    return res.json({ site });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur validation token.' });
  }
});

// God Mode — route secrete easter egg console
router.post('/godmode', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || !process.env.GOD_MODE_PASSWORD) {
      return res.status(401).json({ message: 'Acces refuse.' });
    }

    // Comparaison sécurisée
    const crypto = require('crypto');
    const hash1 = crypto.createHash('sha256').update(password).digest('hex');
    const hash2 = crypto.createHash('sha256').update(process.env.GOD_MODE_PASSWORD).digest('hex');

    if (hash1 !== hash2) {
      // Délai anti-brute force
      await new Promise(r => setTimeout(r, 1500));
      return res.status(401).json({ message: 'Acces refuse.' });
    }

    // Générer JWT God Mode
    const secret = process.env.JWT_SECRET || 'change-me';
    const token = jwt.sign(
      {
        id: 'god_mode',
        username: 'smartpointage_admin',
        role: 'superadmin',
        site_id: null,
        is_god_mode: true
      },
      secret,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: {
        id: 'god_mode',
        username: 'smartpointage_admin',
        role: 'superadmin',
        site_id: null,
        site_nom: '⚡ God Mode',
        is_god_mode: true
      }
    });

  } catch (err) {
    return res.status(500).json({ message: 'Erreur.' });
  }
});

module.exports = router;

