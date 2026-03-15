// Ajouter dans server/routes/auth.js

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
    const jwt = require('jsonwebtoken');
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
