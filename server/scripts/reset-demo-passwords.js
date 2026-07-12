/**
 * reset-demo-passwords.js
 * Remet tous les comptes utilisateurs de démo à leurs mots de passe seed d'origine.
 * Usage : node server/scripts/reset-demo-passwords.js
 *
 * ⚠️  Ne jamais exécuter en production sur des vrais comptes client.
 */

const dotenv = require('dotenv');
dotenv.config();

const { connectDB, mongoose } = require('../config/db');
const User = require('../models/User');

// ─── Mots de passe par défaut par tenant ─────────────────────────────────────

const DEMO_USERS = [
  // ── PAMECAS ──────────────────────────────────────────────────────────────────
  { username: 'admin',            password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'directeur.dakar',  password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.dg',         password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.bene',       password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.bourg',      password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.cast',       password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.avion',      password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.gyoff',      password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.hlm',        password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.ouak',       password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.vdn',        password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.yoff',       password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'admin.stl',        password: 'pamecas2024!', tenant: 'pamecas' },
  { username: 'point.dg',         password: 'point2024!',   tenant: 'pamecas' },
  { username: 'point.bene',       password: 'point2024!',   tenant: 'pamecas' },
  { username: 'point.stl',        password: 'point2024!',   tenant: 'pamecas' },

  // ── CMS (Crédit Mutuel Sénégal) ──────────────────────────────────────────────
  { username: 'admin.cms',              password: 'cms2024!',   tenant: 'cms' },
  { username: 'directeur.cms',          password: 'cms2024!',   tenant: 'cms' },
  { username: 'admin.dg@cms',           password: 'cms2024!',   tenant: 'cms' },
  { username: 'admin.gyoff@cms',        password: 'cms2024!',   tenant: 'cms' },
  { username: 'admin.pikine@cms',       password: 'cms2024!',   tenant: 'cms' },
  { username: 'admin.guediawaye@cms',   password: 'cms2024!',   tenant: 'cms' },
  { username: 'admin.thies@cms',        password: 'cms2024!',   tenant: 'cms' },
  { username: 'point.dg@cms',           password: 'point2024!', tenant: 'cms' },

  // ── GMV (ASERGMV / Grande Muraille Verte) ────────────────────────────────────
  { username: 'directeur.gmv',    password: 'gmv2024!', tenant: 'gmv' },
  { username: 'inspecteur.sl',    password: 'gmv2024!', tenant: 'gmv' },
  { username: 'inspecteur.lg',    password: 'gmv2024!', tenant: 'gmv' },
  { username: 'inspecteur.tb',    password: 'gmv2024!', tenant: 'gmv' },
  { username: 'chef.rao',         password: 'gmv2024!', tenant: 'gmv' },
  { username: 'chef.bango',       password: 'gmv2024!', tenant: 'gmv' },
  { username: 'chef.podor',       password: 'gmv2024!', tenant: 'gmv' },
  { username: 'chef.widou',       password: 'gmv2024!', tenant: 'gmv' },
  { username: 'chef.lompoul',     password: 'gmv2024!', tenant: 'gmv' },
  { username: 'chef.bakel',       password: 'gmv2024!', tenant: 'gmv' },
  { username: 'chef.goudiry',     password: 'gmv2024!', tenant: 'gmv' },
  { username: 'pointeur.rao',     password: 'gmv2024!', tenant: 'gmv' },
  { username: 'pointeur.bango',   password: 'gmv2024!', tenant: 'gmv' },
  { username: 'pointeur.widou',   password: 'gmv2024!', tenant: 'gmv' },
  { username: 'pointeur.bakel',   password: 'gmv2024!', tenant: 'gmv' },
];

// ─── Reset ────────────────────────────────────────────────────────────────────

async function resetDemoPasswords() {
  await connectDB();

  // Attendre la connexion
  await new Promise((resolve, reject) => {
    const conn = mongoose.connection;
    if (conn.readyState === 1) return resolve();
    conn.once('connected', resolve);
    conn.once('error', reject);
  });

  console.log('');
  console.log('=== RESET MOTS DE PASSE DEMO ===');
  console.log('');

  let updated = 0;
  let notFound = 0;
  const results = { pamecas: [], cms: [], gmv: [] };

  for (const u of DEMO_USERS) {
    const user = await User.findOne({ username: u.username });

    if (!user) {
      console.log(`  ⚠️  Introuvable : ${u.username}`);
      notFound++;
      continue;
    }

    // Forcer le changement en marquant le champ comme modifié
    user.password = u.password;
    user.markModified('password');
    await user.save(); // Le hook pre('save') va hasher automatiquement

    results[u.tenant].push(`  ✅  ${u.username}`);
    updated++;
  }

  // Affichage groupé par tenant
  for (const [tenant, lines] of Object.entries(results)) {
    if (lines.length === 0) continue;
    console.log(`\n── ${tenant.toUpperCase()} ──`);
    lines.forEach(l => console.log(l));
  }

  console.log('');
  console.log(`=== TERMINÉ : ${updated} réinitialisés, ${notFound} introuvables ===`);
  console.log('');
  console.log('Mots de passe par défaut :');
  console.log('  PAMECAS admins  → pamecas2024!');
  console.log('  PAMECAS pointeurs → point2024!');
  console.log('  CMS admins      → cms2024!');
  console.log('  CMS pointeurs   → point2024!');
  console.log('  GMV tous        → gmv2024!');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

resetDemoPasswords().catch(err => {
  console.error('Erreur :', err);
  process.exit(1);
});
