const dotenv = require('dotenv');

dotenv.config();

const { connectDB, mongoose } = require('./config/db');
const Site = require('./models/Site');
const User = require('./models/User');

async function seed() {
  try {
    await connectDB();

    await new Promise((resolve, reject) => {
      const conn = mongoose.connection;
      if (conn.readyState === 1) return resolve();
      conn.once('connected', resolve);
      conn.once('error', reject);
    });

    // Agences PAMECAS
    const agences = [
      { code: 'PAM-DG',    nom: 'Direction Générale',  region: 'Dakar', telephone: '77 388 62 07' },
      { code: 'PAM-BENE',  nom: 'Agence Béne Tally',   region: 'Dakar', telephone: '77 827 34 91' },
      { code: 'PAM-BOURG', nom: 'Agence Bourguiba',     region: 'Dakar', telephone: '77 388 62 07' },
      { code: 'PAM-CAST',  nom: 'Agence Castors',       region: 'Dakar', telephone: '77 463 02 20' },
      { code: 'PAM-AVION', nom: 'Agence Cité Avion',    region: 'Dakar', telephone: '77 529 67 61' },
      { code: 'PAM-GYOFF', nom: 'Agence Grand Yoff',    region: 'Dakar', telephone: '77 265 38 12' },
      { code: 'PAM-HLM',   nom: 'Agence HLM',           region: 'Dakar', telephone: '77 367 51 89' },
      { code: 'PAM-OUAK',  nom: 'Agence Ouakam',        region: 'Dakar', telephone: '77 638 34 14' },
      { code: 'PAM-VDN',   nom: 'Agence VDN',           region: 'Dakar', telephone: '77 332 49 46' },
      { code: 'PAM-YOFF',  nom: 'Agence Yoff',          region: 'Dakar', telephone: '77 819 57 79' },
    ];

    for (const agence of agences) {
      await Site.findOneAndUpdate(
        { code: agence.code },
        agence,
        { upsert: true, new: true }
      );
    }

    // Supprimer l'ancien site GDS si présent
    await Site.deleteOne({ code: 'GDS-PRINCIPAL' });

    // Récupérer la Direction Générale pour le pointeur
    const dg = await Site.findOne({ code: 'PAM-DG' });

    const usersToSeed = [
      {
        username: 'admin',
        password: 'pamecas2024!',
        role: 'superadmin',
        nom_complet: 'Super Administrateur PAMECAS'
      },
      {
        username: 'pointeur',
        password: 'point2024!',
        role: 'pointeur',
        nom_complet: 'Pointeur Test',
        site_id: dg ? dg._id : null
      }
    ];

    for (const userData of usersToSeed) {
      const existingUser = await User.findOne({ username: userData.username });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
      }
    }

    console.log('✅ DB initialisée — PAMECAS');
  } catch (err) {
    console.error('❌ Erreur lors du seed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();