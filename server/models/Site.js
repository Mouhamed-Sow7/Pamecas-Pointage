const mongoose = require('mongoose');

const REGIONS_SENEGAL = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kédougou',
  'Kolda',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Sédhiou',
  'Tambacounda',
  'Thiès',
  'Ziguinchor'
];

const CoordonneesSchema = new mongoose.Schema(
  {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  { _id: false }
);

const ConfigSiteSchema = new mongoose.Schema(
  {
    heure_debut: { type: String }, // ex: "07:30"
    heure_retard: { type: String }, // ex: "08:00"
    weekend_actif: { type: Boolean, default: false }
  },
  { _id: false }
);

const SiteSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true, trim: true },
    nom: { type: String, required: true, trim: true },
    region: {
      type: String,
      enum: REGIONS_SENEGAL,
      required: true
    },
    responsable: { type: String },
    telephone: { type: String },
    coordonnees: CoordonneesSchema,
    actif: { type: Boolean, default: true },
    config: ConfigSiteSchema
  },
  { timestamps: true }
);

module.exports = mongoose.model('Site', SiteSchema);

