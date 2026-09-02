const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const DEFAULT_LOCAL_URI = 'mongodb://localhost:27017/gds_pointage';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_LOCAL_URI;

let isConnectedBefore = false;

async function connectWithRetry() {
  try {
    await mongoose.connect(MONGODB_URI, {
      autoIndex: true,
      maxPoolSize: 10
    });
  } catch (err) {
    console.error('❌ Erreur de connexion MongoDB:', err.message);
    console.log('Nouvelle tentative de connexion dans 5 secondes...');
    setTimeout(connectWithRetry, 5000);
  }
}

mongoose.connection.on('connected', () => {
  isConnectedBefore = true;
  console.log('✅ Connecté à MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur MongoDB:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  Déconnecté de MongoDB');
  if (!isConnectedBefore) {
    connectWithRetry();
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 Reconnecté à MongoDB');
});

function connectDB() {
  connectWithRetry();
}

module.exports = {
  connectDB,
  mongoose
};