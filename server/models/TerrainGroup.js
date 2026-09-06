const mongoose = require("mongoose");

// ─── Groupe de pointage terrain ────────────────────────────────────
// Un groupe = une equipe d'agents mobiles rattachee a une zone,
// avec un "pointeur" (agent/device responsable du pointage du groupe
// ce jour-la). Le detail des appartenances datees (transferts d'un
// agent entre groupes) sera gere par un futur modele GroupMembership —
// ce schema pose seulement la structure de base du groupe.

const CoordonneesSchema = new mongoose.Schema(
  {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { _id: false },
);

const TerrainGroupSchema = new mongoose.Schema(
  {
    instance_slug: {
      type: String,
      default: "pamecas",
      lowercase: true,
      trim: true,
      index: true,
    },
    code: { type: String, unique: true, required: true, trim: true },
    nom: { type: String, required: true, trim: true },
    zone_centre: CoordonneesSchema,
    rayon_geofence_m: { type: Number, default: 500 },
    // Site d'attache optionnel — utilise pour un tenant hybride ou
    // une agence a des equipes terrain rattachees a un site fixe.
    site_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
    },
    pointeur_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actif: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("TerrainGroup", TerrainGroupSchema);
