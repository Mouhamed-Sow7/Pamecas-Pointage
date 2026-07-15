const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Device — stocke les credentials WebAuthn (Passkey) par agent.
 * Un agent peut avoir plusieurs appareils enregistrés (téléphone perso + pro).
 * Chaque credential est lié à un appareil physique via la biométrie du système.
 */
const DeviceSchema = new Schema(
  {
    // Lien agent
    agent_id: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },

    instance_slug: {
      type: String,
      required: true,
      index: true,
    },

    // Identifiant unique du credential WebAuthn (base64url)
    credential_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Clé publique WebAuthn (base64url) — vérifie les signatures
    public_key: {
      type: String,
      required: true,
    },

    // Compteur anti-clonage — doit toujours augmenter à chaque auth
    counter: {
      type: Number,
      default: 0,
    },

    // Infos affichage (user-agent parsé)
    device_name: {
      type: String,
      default: "Appareil inconnu",
    },

    // Type de transport déclaré par l'authenticator
    transports: {
      type: [String],
      default: [],
    },

    // Statut
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      index: true,
    },

    // Dernière utilisation
    last_used_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index composé : un agent ne peut pas avoir deux credentials identiques
DeviceSchema.index({ agent_id: 1, credential_id: 1 }, { unique: true });

module.exports = mongoose.model("Device", DeviceSchema);
