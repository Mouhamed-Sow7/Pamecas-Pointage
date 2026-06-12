const mongoose = require("mongoose");
const { Schema } = mongoose;

const AgentSchema = new Schema(
  {
    matricule: {
      type: String,
      unique: true,
      index: true,
    },
    nom: {
      type: String,
      required: true,
      trim: true,
    },
    prenom: {
      type: String,
      required: true,
      trim: true,
    },
    telephone: {
      type: String,
      trim: true,
    },
    site_id: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      index: true,
      required: true,
    },
    type_contrat: {
      type: String,
      enum: ["CDI", "CDD", "stage", "prestataire"],
      required: true,
      index: true,
    },
    poste: {
      type: String,
      trim: true,
    },
    statut: {
      type: String,
      enum: ["actif", "inactif", "suspendu"],
      default: "actif",
      index: true,
    },
    photo: {
      type: String, // base64
    },
    date_embauche: {
      type: Date,
    },
    qr_data: {
      type: String,
    },
    // OTP SMS fallback kiosque
    otp_code: {
      type: String,
      default: null,
    },
    otp_expires_at: {
      type: Date,
      default: null,
    },
    // TOTP QR dynamique
    totp_secret: {
      type: String,
      default: null,
    },
    totp_enabled: {
      type: Boolean,
      default: false,
    },
    // Auth portail agent
    password_hash: {
      type: String,
      default: null,
    },
    // Session unique kiosque/portail
    session_token: {
      type: String,
      default: null,
      index: true,
    },
    session_device: {
      type: String,
      default: null,
    },
    // Congés
    jours_conge_annuels: {
      type: Number,
      default: 30,
    },
    jours_conge_acquis: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

AgentSchema.index({ site_id: 1, statut: 1 });

async function generateMatricule(doc) {
  const Agent = mongoose.model("Agent");

  // Chercher le dernier matricule SMP- (nouveaux)
  // ou GDS- (anciens) pour assurer la continuité
  const lastAgent = await Agent.findOne({
    matricule: { $regex: /^(SMP|GDS)-\d{4}$/ },
  })
    .sort({ createdAt: -1 })
    .select("matricule")
    .lean();

  let nextNumber = 1;
  if (lastAgent?.matricule) {
    const parts = lastAgent.matricule.split("-");
    const num = parseInt(parts[1], 10);
    if (!Number.isNaN(num)) nextNumber = num + 1;
  }

  return `SMP-${String(nextNumber).padStart(4, "0")}`;
}

AgentSchema.pre("save", async function preSave(next) {
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

// Methode pour generer OTP
AgentSchema.methods.genererOTP = function () {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 chiffres
  this.otp_code = code;
  this.otp_expires_at = new Date(Date.now() + 5 * 60 * 1000); // expire dans 5 min
  return code;
};

// Methode pour verifier OTP
AgentSchema.methods.verifierOTP = function (code) {
  if (!this.otp_code || !this.otp_expires_at) return false;
  if (new Date() > this.otp_expires_at) return false;
  return this.otp_code === code;
};

// Methode pour invalider OTP apres usage
AgentSchema.methods.invaliderOTP = async function () {
  this.otp_code = null;
  this.otp_expires_at = null;
  await this.save();
};

// Methode pour generer secret TOTP
AgentSchema.methods.genererTOTPSecret = function () {
  const crypto = require("crypto");
  this.totp_secret = crypto.randomBytes(32).toString("hex");
  this.totp_enabled = true;
  return this.totp_secret;
};

module.exports = mongoose.model("Agent", AgentSchema);
