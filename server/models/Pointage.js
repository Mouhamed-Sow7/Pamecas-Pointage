const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const PointageSchema = new Schema(
  {
    local_id: {
      type: String,
      unique: true,
      default: uuidv4
    },
    agent_id: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true
    },
    site_id: {
      type: Schema.Types.ObjectId,
      ref: 'Site',
      required: true
    },
    date: {
      type: String,
      required: true // format YYYY-MM-DD
    },
    heure_arrivee: {
      type: String // ex: "07:45"
    },
    heure_depart: {
      type: String
    },
    statut: {
      type: String,
      enum: ['present', 'absent', 'retard', 'conge', 'justifie'],
      required: true
    },
    methode: {
      type: String,
      enum: ['qr_code', 'manuel'],
      required: true
    },
    superviseur_id: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    note: {
      type: String
    },
    sync_status: {
      type: String,
      enum: ['local', 'synced', 'conflict'],
      default: 'local'
    },
    synced_at: {
      type: Date
    }
  },
  { timestamps: true }
);

PointageSchema.index(
  { agent_id: 1, site_id: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model('Pointage', PointageSchema);

