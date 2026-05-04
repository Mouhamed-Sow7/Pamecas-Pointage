const mongoose = require("mongoose");
const { Schema } = mongoose;

const CongeSchema = new Schema(
  {
    agent_id: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    site_id: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    date_debut: { type: String, required: true },
    date_fin: { type: String, required: true },
    nb_jours: { type: Number, required: true },
    type: {
      type: String,
      enum: ["annuel", "maladie", "maternite", "exceptionnel"],
      default: "annuel",
    },
    motif: { type: String, default: "" },
    statut: {
      type: String,
      enum: ["en_attente", "approuve", "refuse"],
      default: "en_attente",
      index: true,
    },
    commentaire_rh: { type: String, default: "" },
    approuve_par: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approuve_le: { type: Date, default: null },
  },
  { timestamps: true },
);

CongeSchema.index({ agent_id: 1, statut: 1 });
CongeSchema.index({ site_id: 1, statut: 1, date_debut: 1 });

module.exports = mongoose.model("Conge", CongeSchema);
