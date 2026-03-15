// server/scripts/migrate_matricules.js
// Script one-shot : renomme GDS-XXXX -> SMP-XXXX en DB
const dotenv = require('dotenv');
dotenv.config();
const { connectDB, mongoose } = require('../config/db');
const Agent = require('../models/Agent');
const Pointage = require('../models/Pointage');

async function migrate() {
  try {
    await connectDB();
    await new Promise((resolve, reject) => {
      const conn = mongoose.connection;
      if (conn.readyState === 1) return resolve();
      conn.once('connected', resolve);
      conn.once('error', reject);
    });

    console.log('Migration matricules GDS -> SMP...');

    // Trouver tous les agents avec matricule GDS-
    const agents = await Agent.find({ matricule: /^GDS-/ });
    console.log(`${agents.length} agents a migrer`);

    let migres = 0;
    for (const agent of agents) {
      const ancienMatricule = agent.matricule;
      const nouveauMatricule = ancienMatricule.replace('GDS-', 'SMP-');

      // Verifier que le nouveau matricule n'existe pas deja
      const existe = await Agent.findOne({ matricule: nouveauMatricule });
      if (existe) {
        console.log(`SKIP ${ancienMatricule} -> ${nouveauMatricule} (deja existant)`);
        continue;
      }

      // Mettre a jour l'agent
      agent.matricule = nouveauMatricule;
      agent.qr_data = nouveauMatricule; // mettre a jour le QR data aussi
      await agent.save();

      migres++;
      console.log(`${ancienMatricule} -> ${nouveauMatricule}`);
    }

    console.log('');
    console.log(`=== MIGRATION TERMINEE ===`);
    console.log(`${migres} agents migres sur ${agents.length}`);

  } catch (err) {
    console.error('Erreur migration:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrate();