const express = require('express');
const Joi = require('joi');
const QRCode = require('qrcode');

const Agent = require('../models/Agent');
const Pointage = require('../models/Pointage');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

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
    if (!matricule) {
      return res
        .status(400)
        .json({ message: 'Le matricule est requis pour la recherche.' });
    }

    const agent = await Agent.findOne({ matricule })
      .populate('site_id')
      .exec();

    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé.' });
    }

    return res.json(agent);
  } catch (err) {
    console.error("Erreur lors de la recherche de l'agent par matricule:", err);
    return res.status(500).json({
      message: "Erreur lors de la recherche de l'agent par matricule."
    });
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

