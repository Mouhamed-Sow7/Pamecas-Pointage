const express = require('express');
const Joi = require('joi');
const QRCode = require('qrcode');
const multer = require('multer');
const { parse: csvParse } = require('csv-parse/sync');

const Agent = require('../models/Agent');
const Pointage = require('../models/Pointage');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── QR Sheet — doit précéder router.use(authenticate) pour accepter token en query ──
router.get('/qr-sheet/:site_id', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authenticate, authorizeRoles('superadmin', 'admin'), async (req, res) => {
  try {
    const agents = await Agent.find({
      site_id: req.params.site_id,
      statut: 'actif'
    }).populate('site_id', 'nom code').sort({ nom: 1 });

    if (!agents.length) return res.status(404).json({ message: 'Aucun agent actif dans cette agence.' });

    const site = agents[0].site_id;

    const cartes = await Promise.all(agents.map(async (agent) => {
      const qrDataUrl = await QRCode.toDataURL(agent.matricule, {
        width: 200,
        margin: 1,
        color: { dark: '#1b5e20', light: '#ffffff' }
      });
      return { agent, qrDataUrl };
    }));

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>QR Codes — ${site.nom}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    h1 { text-align:center; color: #1b5e20; margin-bottom: 6px; font-size: 1.4rem; }
    .subtitle { text-align:center; color: #666; font-size: 0.85rem; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 900px; margin: 0 auto; }
    .card { background: white; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e8f5e9; break-inside: avoid; }
    .card-header { background: linear-gradient(135deg, #1b5e20, #2e7d32); color: white; border-radius: 8px; padding: 6px 10px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 12px; }
    .qr-img { width: 140px; height: 140px; margin: 0 auto 10px; display: block; }
    .agent-nom { font-weight: 700; font-size: 0.9rem; color: #1f2933; margin-bottom: 2px; }
    .agent-matricule { font-size: 0.75rem; color: #2e7d32; font-weight: 600; margin-bottom: 2px; }
    .agent-poste { font-size: 0.72rem; color: #888; }
    .agent-contrat { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 10px; background: #e8f5e9; color: #2e7d32; font-size: 0.68rem; font-weight: 600; }
    @media print { body { background: white; padding: 10px; } .no-print { display: none; } .grid { gap: 10px; } }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:20px;">
    <button onclick="window.print()" style="padding:10px 24px;background:#2e7d32;color:white;border:none;border-radius:8px;font-size:1rem;cursor:pointer;font-weight:600;">
      🖨️ Imprimer / Sauvegarder PDF
    </button>
    <span style="margin-left:16px;color:#888;font-size:0.85rem;">Utilisez Ctrl+P puis "Enregistrer en PDF"</span>
  </div>
  <h1>SmartPointage — Cartes QR Code</h1>
  <div class="subtitle">${site.nom} · ${agents.length} agents · Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
  <div class="grid">
    ${cartes.map(({ agent, qrDataUrl }) => `
    <div class="card">
      <div class="card-header">SMARTPOINTAGE · ${site.code}</div>
      <img class="qr-img" src="${qrDataUrl}" alt="QR ${agent.matricule}">
      <div class="agent-nom">${agent.nom} ${agent.prenom}</div>
      <div class="agent-matricule">${agent.matricule}</div>
      <div class="agent-poste">${agent.poste || ''}</div>
      <span class="agent-contrat">${agent.type_contrat.toUpperCase()}</span>
    </div>`).join('')}
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur génération QR sheet.' });
  }
});

router.use(authenticate);

const createAgentSchema = Joi.object({
  nom: Joi.string().trim().required().messages({
    'string.empty': 'Le nom est requis.'
  }),
  prenom: Joi.string().trim().required().messages({
    'string.empty': 'Le prénom est requis.'
  }),
  site_id: Joi.string().required().messages({
    'any.required': 'Le site est requis.'
  }),
  type_contrat: Joi.string()
    .valid('CDI', 'CDD', 'stage', 'prestataire')
    .required()
    .messages({
      'any.only': 'Le type de contrat doit être CDI, CDD, stage ou prestataire.',
      'any.required': 'Le type de contrat est requis.'
    }),
  telephone: Joi.string()
    .pattern(/^(77|78|76|75|70|33)[0-9]{7}$/)
    .allow(null, '')
    .messages({
      'string.pattern.base':
        'Le numéro de téléphone doit être un numéro sénégalais valide.'
    }),
  poste: Joi.string().allow('', null),
  statut: Joi.string()
    .valid('actif', 'inactif', 'suspendu')
    .optional(),
  photo: Joi.string().allow('', null),
  date_embauche: Joi.date().optional()
});

const updateAgentSchema = Joi.object({
  nom: Joi.string().trim(),
  prenom: Joi.string().trim(),
  site_id: Joi.string(),
  type_contrat: Joi.string().valid('CDI', 'CDD', 'stage', 'prestataire'),
  telephone: Joi.string()
    .pattern(/^(77|78|76|75|70|33)[0-9]{7}$/)
    .allow(null, '')
    .messages({
      'string.pattern.base':
        'Le numéro de téléphone doit être un numéro sénégalais valide.'
    }),
  poste: Joi.string().allow('', null),
  statut: Joi.string().valid('actif', 'inactif', 'suspendu'),
  photo: Joi.string().allow('', null),
  date_embauche: Joi.date()
}).min(1);

router.get('/', async (req, res) => {
  try {
    const {
      site_id,
      type_contrat,
      statut,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (site_id) {
      query.site_id = site_id;
    }
    if (type_contrat) {
      query.type_contrat = type_contrat;
    }
    if (statut) {
      query.statut = statut;
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ nom: regex }, { prenom: regex }, { matricule: regex }];
    }

    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Number.parseInt(limit, 10) || 50;
    const skip = (pageNumber - 1) * limitNumber;

    const [items, total] = await Promise.all([
      Agent.find(query)
        .select('-photo')
        .populate('site_id', 'nom code')
        .skip(skip)
        .limit(limitNumber)
        .sort({ createdAt: -1 }),
      Agent.countDocuments(query)
    ]);

    return res.json({
      data: items,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber) || 1
      }
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des agents:', err);
    return res
      .status(500)
      .json({ message: 'Erreur lors de la récupération des agents.' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { matricule } = req.query;
    if (!matricule) return res.status(400).json({ message: 'Matricule requis.' });

    const filter = { matricule: matricule.toUpperCase(), statut: 'actif' };

    // Si token kiosque — filtrer uniquement les agents de cette agence
    if (req.user.is_kiosque && req.user.site_id) {
      filter.site_id = req.user.site_id;
    }

    const agent = await Agent.findOne(filter).populate('site_id', 'nom code');
    if (!agent) return res.status(404).json({ message: 'Agent introuvable pour cette agence.' });
    return res.json(agent);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur recherche agent.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await Agent.findById(id).populate('site_id');

    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé.' });
    }

    return res.json(agent);
  } catch (err) {
    console.error("Erreur lors de la récupération de l'agent:", err);
    return res
      .status(500)
      .json({ message: "Erreur lors de la récupération de l'agent." });
  }
});

router.get('/:id/qr', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await Agent.findById(id);

    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé.' });
    }

    const dataToEncode = agent.matricule;

    const dataUrl = await QRCode.toDataURL(dataToEncode, {
      type: 'image/png'
    });
    const base64 = dataUrl.split(',')[1];

    return res.json({
      matricule: agent.matricule,
      qr_base64: base64
    });
  } catch (err) {
    console.error('Erreur lors de la génération du QR code:', err);
    return res
      .status(500)
      .json({ message: 'Erreur lors de la génération du QR code.' });
  }
});

router.post(
  '/',
  authorizeRoles('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { error, value } = createAgentSchema.validate(req.body, {
        abortEarly: false
      });
      if (error) {
        return res.status(400).json({
          message: 'Données invalides.',
          details: error.details.map((d) => d.message)
        });
      }

      const agent = new Agent({
        nom: value.nom,
        prenom: value.prenom,
        site_id: value.site_id,
        type_contrat: value.type_contrat,
        telephone: value.telephone,
        poste: value.poste,
        statut: value.statut,
        photo: value.photo,
        date_embauche: value.date_embauche
      });

      await agent.save();

      const agentSansPhoto = agent.toObject();
      delete agentSansPhoto.photo;

      return res.status(201).json(agentSansPhoto);
    } catch (err) {
      console.error("Erreur lors de la création de l'agent:", err);
      if (err.code === 11000) {
        return res.status(409).json({
          message: 'Un agent avec ce matricule existe déjà.'
        });
      }
      return res
        .status(500)
        .json({ message: "Erreur lors de la création de l'agent." });
    }
  }
);

router.put(
  '/:id',
  authorizeRoles('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { error, value } = updateAgentSchema.validate(req.body, {
        abortEarly: false
      });
      if (error) {
        return res.status(400).json({
          message: 'Données invalides.',
          details: error.details.map((d) => d.message)
        });
      }

      const fieldsToUpdate = {};

      const updatableFields = [
        'nom',
        'prenom',
        'telephone',
        'poste',
        'statut',
        'type_contrat',
        'site_id',
        'photo',
        'date_embauche'
      ];

      updatableFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(value, field)) {
          fieldsToUpdate[field] = value[field];
        }
      });

      if (Object.keys(fieldsToUpdate).length === 0) {
        return res
          .status(400)
          .json({ message: 'Aucune donnée à mettre à jour.' });
      }

      const agent = await Agent.findByIdAndUpdate(id, fieldsToUpdate, {
        new: true
      }).populate('site_id');

      if (!agent) {
        return res.status(404).json({ message: 'Agent non trouvé.' });
      }

      return res.json(agent);
    } catch (err) {
      console.error("Erreur lors de la mise à jour de l'agent:", err);
      return res
        .status(500)
        .json({ message: "Erreur lors de la mise à jour de l'agent." });
    }
  }
);

router.delete(
  '/:id',
  authorizeRoles('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const agent = await Agent.findByIdAndUpdate(
        id,
        { statut: 'inactif' },
        { new: true }
      );

      if (!agent) {
        return res.status(404).json({ message: 'Agent non trouvé.' });
      }

      return res.json({
        message: "Agent désactivé avec succès (suppression logique).",
        agent
      });
    } catch (err) {
      console.error('Erreur lors de la désactivation de l’agent:', err);
      return res.status(500).json({
        message: 'Erreur lors de la désactivation de l’agent.'
      });
    }
  }
);

// ─── POST /import-csv — Import agents depuis CSV ─────────────────
router.post('/import-csv', authenticate, authorizeRoles('superadmin', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Fichier CSV requis.' });

    const site_id = req.body.site_id || req.user.site_id;
    if (!site_id) return res.status(400).json({ message: 'site_id obligatoire.' });

    // Parser le CSV manuellement pour eviter les problemes de module
    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV vide ou sans donnees.' });
    }

    // Detecter separateur
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

    console.log('Headers CSV detectes:', headers);
    console.log('Separateur:', sep);
    console.log('Nombre de lignes:', lines.length - 1);

    const results = { created: 0, skipped: 0, errors: [] };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(sep).map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      try {
        const nom = row.nom || '';
        const prenom = row.prenom || '';
        const type_contrat_raw = (row.type_contrat || row.contrat || 'cdi').toLowerCase().trim();
        const telephone = row.telephone || row.tel || '';
        const poste = row.poste || '';

        if (!nom || !prenom) {
          results.errors.push(`Ligne ${i}: nom ou prenom manquant`);
          continue;
        }

        const type_contrat = ['cdi','cdd','stage','prestataire'].includes(type_contrat_raw)
          ? type_contrat_raw : 'CDI';

        const existing = await Agent.findOne({ nom: nom.trim(), prenom: prenom.trim(), site_id });
        if (existing) { results.skipped++; continue; }

        const agent = new Agent({
          nom: nom.trim(),
          prenom: prenom.trim(),
          type_contrat,
          telephone: telephone.trim(),
          poste: poste.trim(),
          site_id,
          statut: 'actif'
        });

        await agent.save();
        results.created++;
        console.log(`Agent cree: ${nom} ${prenom}`);

      } catch (e) {
        console.error(`Erreur ligne ${i}:`, e.message);
        results.errors.push(`Ligne ${i}: ${e.message}`);
      }
    }

    return res.json({
      message: `Import termine: ${results.created} cree(s), ${results.skipped} ignore(s)`,
      created: results.created,
      skipped: results.skipped,
      errors: results.errors
    });

  } catch (err) {
    console.error('Erreur import CSV:', err);
    return res.status(500).json({ message: 'Erreur import: ' + err.message });
  }
});

// ─── POST /otp/send — Envoyer OTP SMS ───────────────────────────
router.post('/otp/send', async (req, res) => {
  try {
    const { matricule } = req.body;
    if (!matricule) return res.status(400).json({ message: 'Matricule obligatoire.' });

    const agent = await Agent.findOne({ matricule: matricule.toUpperCase(), statut: 'actif' });
    if (!agent) return res.status(404).json({ message: 'Agent introuvable.' });
    if (!agent.telephone) return res.status(400).json({ message: 'Aucun telephone enregistre pour cet agent.' });

    const code = agent.genererOTP();
    await agent.save();

    // TODO: brancher Twilio ou Orange SMS ici
    // Pour l'instant on log le code (demo)
    console.log(`OTP pour ${matricule}: ${code}`);

    // Masquer le telephone : 77 XXX XX XX -> 77 XXX ** **
    const tel = agent.telephone;
    const telMasque = tel.length > 4 ? tel.slice(0, -4) + '** **' : '** ** ** **';

    return res.json({
      message: 'Code envoye par SMS.',
      telephone_masque: telMasque
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur envoi OTP.' });
  }
});

// ─── POST /otp/verify — Verifier OTP et pointer ─────────────────
router.post('/otp/verify', async (req, res) => {
  try {
    const { matricule, code, site_id } = req.body;
    if (!matricule || !code || !site_id) {
      return res.status(400).json({ message: 'Matricule, code et site_id obligatoires.' });
    }

    const agent = await Agent.findOne({ matricule: matricule.toUpperCase(), statut: 'actif' });
    if (!agent) return res.status(404).json({ message: 'Agent introuvable.' });

    if (!agent.verifierOTP(code)) {
      return res.status(400).json({ message: 'Code incorrect ou expire.' });
    }

    await agent.invaliderOTP();

    // Determiner arrivee ou depart
    const dateStr = new Date().toISOString().split('T')[0];
    const heure = new Date().toTimeString().slice(0, 5);

    let pointage = await Pointage.findOne({ agent_id: agent._id, site_id, date: dateStr });
    let type = 'arrivee';

    if (!pointage) {
      pointage = new Pointage({
        agent_id: agent._id,
        site_id,
        date: dateStr,
        heure_arrivee: heure,
        statut: 'present',
        methode: 'manuel',
        sync_status: 'synced',
        synced_at: new Date()
      });
    } else {
      if (pointage.heure_depart) {
        return res.status(400).json({ message: 'Depart deja enregistre aujourd\'hui.' });
      }
      type = 'depart';
      pointage.heure_depart = heure;
      if (pointage.heure_arrivee) {
        const [h1, m1] = pointage.heure_arrivee.split(':').map(Number);
        const [h2, m2] = heure.split(':').map(Number);
        pointage.duree_minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      }
      pointage.sync_status = 'synced';
    }

    await pointage.save();

    return res.json({
      message: 'Pointage enregistre.',
      type,
      agent: {
        _id: agent._id,
        nom: agent.nom,
        prenom: agent.prenom,
        matricule: agent.matricule
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur verification OTP.' });
  }
});

module.exports = router;

