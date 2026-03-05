const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const SyncQueueSchema = new Schema(
  {
    local_id: {
      type: String,
      unique: true,
      default: uuidv4
    },
    collection: {
      type: String,
      enum: ['pointages', 'agents'],
      required: true
    },
    operation: {
      type: String,
      enum: ['INSERT', 'UPDATE', 'DELETE'],
      required: true
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true
    },
    statut: {
      type: String,
      enum: ['pending', 'synced', 'error', 'conflict'],
      default: 'pending',
      index: true
    },
    tentatives: {
      type: Number,
      default: 0
    },
    erreur: {
      type: String
    },
    synced_at: {
      type: Date
    }
  },
  { timestamps: true }
);

SyncQueueSchema.index({ statut: 1, createdAt: 1 });

module.exports = mongoose.model('SyncQueue', SyncQueueSchema);

