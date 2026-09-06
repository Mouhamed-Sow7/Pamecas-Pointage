const express = require('express');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Site = require('../models/Site');
const Tenant = require('../models/Tenant');
const TerrainGroup = require('../models/TerrainGroup');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ─── Helpers inscription ───────────────────────────────────────────
function slugify(str) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'tenant';
}

async function generateUniqueSlug(baseName) {
  const base = slugify(baseName);
  let slug = base;
  let i = 1;
  // Evite les collisions avec un tenant existant ou avec 'pamecas' (reserve)
  while (slug === 'pamecas' || (await Tenant.findOne({ slug }))) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

// ─── Config branding par défaut (PAMECAS) ────────────────────────
const DEFAULT_BRANDING = {
  slug: 'pamecas',
  nom: 'PAMECAS',
  instance_label: 'Instance PAMECAS',
  couleur_primaire: '#2e7d32',
  couleur_secondaire: '#1b5e20',
  couleur_accent: '#4caf50',
  bg_dark: '#0f2417',
  mark_text: 'SP',
  mark_color: '#2e7d32',
  mark_text_color: '#ffffff',
  btn_gradient: 'linear-gradient(135deg, #2e7d32, #43a047)',
  btn_shadow: 'rgba(46,125,50,0.3)',
  btn_shadow_hover: 'rgba(46,125,50,0.4)',
  input_focus_color: '#2e7d32',
  input_focus_shadow: 'rgba(46,125,50,0.1)',
  label_icon_color: '#2e7d32',
  feature_icon_color: '#a5d6a7',
  panel_bg: 'linear-gradient(160deg, #1b5e20 0%, #2e7d32 50%, #388e3c 100%)',
  circle_color: '#4CAF50',
};

// ─── Route publique branding (pas besoin d'auth) ──────────────────
router.get('/branding/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase().trim();

    // Toujours retourner PAMECAS si slug = pamecas
    if (slug === 'pamecas') {
      return res.json(DEFAULT_BRANDING);
    }

    const tenant = await Tenant.findOne({ slug, statut: { $in: ['actif', 'trial'] } });

    if (!tenant) {
      // Slug inconnu → branding PAMECAS par défaut
      return res.json(DEFAULT_BRANDING);
    }

    // Construire le branding depuis le tenant
    const couleur = tenant.configuration?.couleur_theme || '#1565C0';
    const nom = tenant.configuration?.instance_name || tenant.nom;

    // Générer les variantes de couleur (assombri/éclairci)
    const branding = {
      slug: tenant.slug,
      nom: tenant.nom,
      instance_label: `Instance ${nom}`,
      couleur_primaire: couleur,
      couleur_secondaire: darkenHex(couleur, 20),
      couleur_accent: lightenHex(couleur, 20),
      bg_dark: darkenHex(couleur, 55),
      mark_text: tenant.slug.substring(0, 3).toUpperCase(),
      mark_color: couleur,
      mark_text_color: '#ffffff',
      btn_gradient: `linear-gradient(135deg, ${couleur}, ${lightenHex(couleur, 10)})`,
      btn_shadow: hexToRgba(couleur, 0.3),
      btn_shadow_hover: hexToRgba(couleur, 0.4),
      input_focus_color: couleur,
      input_focus_shadow: hexToRgba(couleur, 0.1),
      label_icon_color: couleur,
      feature_icon_color: lightenHex(couleur, 35),
      panel_bg: `linear-gradient(160deg, ${darkenHex(couleur, 20)} 0%, ${couleur} 50%, ${lightenHex(couleur, 10)} 100%)`,
      circle_color: lightenHex(couleur, 10),
    };

    return res.json(branding);
  } catch (err) {
    console.error('Erreur branding:', err);
    return res.json(DEFAULT_BRANDING);
  }
});

// ─── Helpers couleur ──────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
function darkenHex(hex, percent) {
  let { r, g, b } = hexToRgb(hex);
  r = Math.max(0, Math.round(r * (1 - percent / 100)));
  g = Math.max(0, Math.round(g * (1 - percent / 100)));
  b = Math.max(0, Math.round(b * (1 - percent / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
function lightenHex(hex, percent) {
  let { r, g, b } = hexToRgb(hex);
  r = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function createTokenPayload(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    role: user.role,
    site_id: user.site_id || null,
    instance_slug: user.instance_slug || 'pamecas'
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

// ─── Liste des regions (pour le formulaire d'inscription) ─────────
router.get('/regions', (req, res) => {
  return res.json({ regions: Site.REGIONS_SENEGAL });
});

// ─── Inscription d'un nouveau tenant ───────────────────────────────
// Cree le Tenant, ses sites et/ou groupes terrain selon le mode
// d'organisation choisi, et le compte administrateur initial.
router.post('/register', async (req, res) => {
  try {
    const { entreprise, mode, sites, groupes, admin } = req.body || {};

    // ─ Validation de base ─
    if (!entreprise || !entreprise.nom || !entreprise.email) {
      return res.status(400).json({ message: "Le nom et l'email de l'entreprise sont requis." });
    }
    if (!['agence', 'terrain', 'hybride'].includes(mode)) {
      return res.status(400).json({ message: 'Mode d\'organisation invalide.' });
    }
    if (!admin || !admin.username || !admin.password) {
      return res.status(400).json({ message: "Un identifiant et un mot de passe administrateur sont requis." });
    }
    if (admin.password.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caracteres.' });
    }

    const needsSites = mode === 'agence' || mode === 'hybride';
    const needsGroupes = mode === 'terrain' || mode === 'hybride';

    if (needsSites && (!Array.isArray(sites) || sites.length === 0)) {
      return res.status(400).json({ message: 'Au moins une agence/un site est requis pour ce mode.' });
    }
    if (needsGroupes && (!Array.isArray(groupes) || groupes.length === 0)) {
      return res.status(400).json({ message: 'Au moins un groupe terrain est requis pour ce mode.' });
    }

    const existingUser = await User.findOne({ username: admin.username.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'Cet identifiant administrateur est deja utilise.' });
    }

    // ─ Tenant ─
    const slug = await generateUniqueSlug(entreprise.nom);
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const tenant = await Tenant.create({
      nom: entreprise.nom,
      slug,
      url: `${slug}.smartpointage.digitalesf.com`,
      mode,
      statut: 'trial',
      date_fin_trial: trialEnd,
      contact: {
        nom: entreprise.contact_nom || '',
        email: entreprise.email,
        telephone: entreprise.telephone || ''
      },
      nb_sites: needsSites ? sites.length : 0
    });

    // ─ Sites (mode agence / hybride) ─
    const createdSites = [];
    if (needsSites) {
      let idx = 0;
      for (const s of sites) {
        idx += 1;
        if (!s || !s.nom || !s.region) {
          continue;
        }
        const site = await Site.create({
          instance_slug: slug,
          code: `${slug.toUpperCase()}-S${idx}`,
          nom: s.nom,
          region: s.region
        });
        createdSites.push(site);
      }
      if (createdSites.length === 0) {
        return res.status(400).json({ message: 'Chaque site doit avoir un nom et une region.' });
      }
    }

    // ─ Groupes terrain (mode terrain / hybride) ─
    const createdGroupes = [];
    if (needsGroupes) {
      let idx = 0;
      for (const g of groupes) {
        idx += 1;
        if (!g || !g.nom) {
          continue;
        }
        const groupe = await TerrainGroup.create({
          instance_slug: slug,
          code: `${slug.toUpperCase()}-G${idx}`,
          nom: g.nom,
          site_id: mode === 'hybride' && createdSites[0] ? createdSites[0]._id : null
        });
        createdGroupes.push(groupe);
      }
      if (createdGroupes.length === 0) {
        return res.status(400).json({ message: 'Chaque groupe terrain doit avoir un nom.' });
      }
    }

    // ─ Compte administrateur ─
    const adminUser = await User.create({
      username: admin.username.toLowerCase(),
      password: admin.password,
      role: 'admin',
      nom_complet: admin.nom_complet || '',
      site_id: createdSites[0] ? createdSites[0]._id : null,
      sites_ids: createdSites.map((s) => s._id),
      instance_slug: slug
    });

    return res.status(201).json({
      message: 'Compte cree avec succes.',
      tenant: { slug: tenant.slug, nom: tenant.nom, mode: tenant.mode },
      admin: { username: adminUser.username }
    });
  } catch (err) {
    console.error('Erreur inscription:', err);
    return res.status(500).json({ message: "Une erreur est survenue lors de l'inscription." });
  }
});

module.exports = router;

