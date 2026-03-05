const express = require('express');
const Joi = require('joi');
const QRCode = require('qrcode');

const Agent = require('../models/Agent');
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
    .valid('permanent', 'journalier', 'saisonnier')
    .required()
    .messages({
      'any.only': 'Le type de contrat doit être permanent, journalier ou saisonnier.',
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
  type_contrat: Joi.string().valid('permanent', 'journalier', 'saisonnier'),
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

module.exports = router;

