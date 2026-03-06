const mongoose = require('mongoose');

const { Schema } = mongoose;

const AgentSchema = new Schema(
  {
    matricule: {
      type: String,
      unique: true,
      index: true
    },
    nom: {
      type: String,
      required: true,
      trim: true
    },
    prenom: {
      type: String,
      required: true,
      trim: true
    },
    telephone: {
      type: String
    },
    site_id: {
      type: Schema.Types.ObjectId,
      ref: 'Site',
      index: true,
      required: true
    },
    type_contrat: {
      type: String,
      enum: ['CDI', 'CDD', 'stage', 'prestataire'],
      required: true,
      index: true
    },
    poste: {
      type: String
    },
    statut: {
      type: String,
      enum: ['actif', 'inactif', 'suspendu'],
      default: 'actif',
      index: true
    },
    photo: {
      type: String // base64
    },
    date_embauche: {
      type: Date
    },
    qr_data: {
      type: String
    }
  },
  { timestamps: true }
);

AgentSchema.index({ site_id: 1, statut: 1 });

async function generateMatricule(doc) {
  const Agent = mongoose.model('Agent');
  const lastAgent = await Agent.findOne({ matricule: /^GDS-\d{4}$/ })
    .sort({ createdAt: -1 })
    .select('matricule')
    .lean();

  let nextNumber = 1;
  if (lastAgent && lastAgent.matricule) {
    const parts = lastAgent.matricule.split('-');
    const num = parseInt(parts[1], 10);
    if (!Number.isNaN(num)) {
      nextNumber = num + 1;
    }
  }

  const padded = String(nextNumber).padStart(4, '0');
  return `GDS-${padded}`;
}

AgentSchema.pre('save', async function preSave(next) {
  try {
    if (this.isNew && !this.matricule) {
      this.matricule = await generateMatricule(this);
    }
    if (!this.qr_data) {
      this.qr_data = this.matricule;
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Agent', AgentSchema);

