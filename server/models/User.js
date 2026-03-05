const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'superviseur', 'pointeur'],
      required: true
    },
    nom_complet: {
      type: String
    },
    site_id: {
      type: Schema.Types.ObjectId,
      ref: 'Site',
      default: null
    },
    actif: {
      type: Boolean,
      default: true
    },
    derniere_connexion: {
      type: Date
    }
  },
  { timestamps: true }
);

UserSchema.pre('save', async function preSave(next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }

    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    return next();
  } catch (err) {
    return next(err);
  }
});

UserSchema.methods.verifyPassword = async function verifyPassword(plaintext) {
  return bcrypt.compare(plaintext, this.password);
};

UserSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);

