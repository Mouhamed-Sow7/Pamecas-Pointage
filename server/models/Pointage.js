const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { Schema } = mongoose;

const PointageSchema = new Schema(
  {
    instance_slug: {
      type: String,
      default: "pamecas",
      lowercase: true,
      trim: true,
      index: true,
    },
    local_id: {
      type: String,
      unique: true,
      default: uuidv4,
    },
    agent_id: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },
    site_id: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },
    date: {
      type: String,
      required: true, // format YYYY-MM-DD
    },
    heure_arrivee: {
      type: String, // ex: "07:45"
    },
    heure_depart: {
      type: String, // ex: "17:30"
    },
    duree_minutes: {
      type: Number, // calculé automatiquement arrivée -> départ
    },
    statut: {
      type: String,
      enum: ["present", "absent", "retard", "partiel", "conge", "justifie"],
      required: true,
    },
    methode: {
      type: String,
      enum: ["qr_code", "manuel"],
      required: true,
    },
    superviseur_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    note: {
      type: String,
      default: "",
    },
    sync_status: {
      type: String,
      enum: ["local", "synced", "conflict"],
      default: "local",
    },
    synced_at: {
      type: Date,
    },
    last_scan_at: {
      type: Date,
      default: null,
    },
    coordonnees_arrivee: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      precision: { type: Number, default: null },
    },
    coordonnees_depart: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      precision: { type: Number, default: null },
    },
    est_partiel: {
      type: Boolean,
      default: false,
    },
    justification_partiel: {
      type: String,
      default: null,
    },
    alerte_depart_envoyee: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

PointageSchema.index({ agent_id: 1, site_id: 1, date: 1 }, { unique: true });
PointageSchema.index({ site_id: 1, date: 1 }); // pour les requêtes par agence/date
PointageSchema.index({ date: 1 }); // pour les rapports

// Securite — herite toujours l'instance_slug du site rattache
PointageSchema.pre("save", async function (next) {
  if (this.isModified("site_id") || this.isNew) {
    try {
      const Site = mongoose.model("Site");
      const site = await Site.findById(this.site_id).select("instance_slug");
      if (site?.instance_slug) this.instance_slug = site.instance_slug;
    } catch (e) {
      // ignore — ne bloque pas la sauvegarde si lookup echoue
    }
  }
  next();
});

module.exports = mongoose.model("Pointage", PointageSchema);
