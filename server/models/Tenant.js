const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  // Informations de base
  nom: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  
  // Modele d'organisation — determine les modules/UI actives pour ce tenant
  mode: {
    type: String,
    enum: ['agence', 'terrain', 'hybride'],
    default: 'agence'
  },

  // Plan et statut
  plan: {
    type: String,
    enum: ['pro', 'enterprise'],
    default: 'pro'
  },
  statut: {
    type: String,
    enum: ['actif', 'trial', 'suspendu'],
    default: 'trial'
  },
  
  // Dates
  date_creation: {
    type: Date,
    default: Date.now
  },
  date_fin_trial: {
    type: Date
  },
  date_prochaine_facturation: {
    type: Date
  },
  
  // Tarification
  tarif_mensuel: {
    type: Number,
    default: 120000 // 120 000 FCFA par défaut
  },
  nb_sites: {
    type: Number,
    default: 1
  },
  
  // Contact
  contact: {
    nom: String,
    email: {
      type: String,
      required: true
    },
    telephone: String
  },
  
  // Configuration
  configuration: {
    couleur_theme: {
      type: String,
      default: '#2E7D32'
    },
    logo_url: String,
    instance_name: String
  },
  
  // Notes administratives
  notes: String,
  
  // Historique des paiements
  paiements: [{
    date: Date,
    montant: Number,
    reference: String,
    statut: {
      type: String,
      enum: ['effectue', 'en_attente', 'echoue'],
      default: 'effectue'
    }
  }],
  
  // Statistiques (calculées)
  stats: {
    nb_agents: {
      type: Number,
      default: 0
    },
    nb_pointages_mois: {
      type: Number,
      default: 0
    },
    derniere_activite: Date
  }
});

// Index pour la recherche
tenantSchema.index({ nom: 'text' });
tenantSchema.index({ statut: 1 });
tenantSchema.index({ plan: 1 });

// Méthode pour calculer le revenu mensuel
tenantSchema.methods.getRevenuMensuel = function() {
  const basePrice = this.plan === 'enterprise' ? 180000 : 120000;
  return this.nb_sites * basePrice;
};

// Méthode pour vérifier si le trial est expiré
tenantSchema.methods.isTrialExpired = function() {
  if (this.statut !== 'trial') return false;
  return new Date() > this.date_fin_trial;
};

// Méthode pour activer le tenant
tenantSchema.methods.activer = function() {
  this.statut = 'actif';
  return this.save();
};

// Méthode pour suspendre le tenant
tenantSchema.methods.suspendre = function() {
  this.statut = 'suspendu';
  return this.save();
};

module.exports = mongoose.model('Tenant', tenantSchema);