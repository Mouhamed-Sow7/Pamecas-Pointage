const dotenv = require('dotenv');

dotenv.config();

const { connectDB, mongoose } = require('./config/db');
const Site = require('./models/Site');
const User = require('./models/User');

async function seed() {
  try {
    await connectDB();

    // Attendre la connexion MongoDB
    await new Promise((resolve, reject) => {
      const conn = mongoose.connection;
      if (conn.readyState === 1) {
        return resolve();
      }
      conn.once('connected', resolve);
      conn.once('error', reject);
    });

    const existingSite = await Site.findOne({ code: 'GDS-PRINCIPAL' });

    let site;
    if (!existingSite) {
      site = await Site.create({
        code: 'GDS-PRINCIPAL',
        nom: 'Site Principal GDS',
        region: 'Dakar'
      });
    } else {
      site = existingSite;
    }

    const usersToSeed = [
      {
        username: 'admin',
        password: 'gds2024!',
        role: 'superadmin',
        nom_complet: 'Super Administrateur'
      },
      {
        username: 'pointeur',
        password: 'point2024!',
        role: 'pointeur',
        nom_complet: 'Pointeur Test',
        site_id: site._id
      }
    ];

    /* eslint-disable no-restricted-syntax */
    for (const userData of usersToSeed) {
      const existingUser = await User.findOne({ username: userData.username });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
      }
    }
    /* eslint-enable no-restricted-syntax */

    console.log('✅ DB initialisée');
  } catch (err) {
    console.error('❌ Erreur lors du seed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();

