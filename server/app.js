const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

const { connectDB } = require('./config/db');

dotenv.config();

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});

// Exposer io pour d'autres modules si besoin
app.set('io', io);

io.on('connection', (socket) => {
  console.log('🔌 Nouvelle connexion Socket.io:', socket.id);

  socket.on('join_site', (siteCode) => {
    if (siteCode) {
      socket.join(`site:${siteCode}`);
      console.log(`Socket ${socket.id} a rejoint la salle site:${siteCode}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Déconnexion Socket.io:', socket.id);
  });
});

// Connexion à la base de données
connectDB();

// Middlewares globaux
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Static client
const publicPath = path.join(__dirname, '..', 'client', 'public');
app.use(express.static(publicPath));

// Routes
const agentsRouter = require('./routes/agents');
const authRouter = require('./routes/auth');
const pointagesRouter = require('./routes/pointages');
const sitesRouter = require('./routes/sites');
const rapportsRouter = require('./routes/rapports');

// Routes de base (stubs pour les modules non encore implémentés)
const routerFactory = (name) => {
  const router = express.Router();
  router.all('*', (req, res) => {
    res.status(501).json({ message: `Route ${name} non implémentée` });
  });
  return router;
};

app.use('/api/auth', authRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/pointages', pointagesRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/rapports', rapportsRouter);
app.use('/api/sync', routerFactory('sync'));

// 404
app.use((req, res, next) => {
  res.status(404).json({
    message: 'Route non trouvée'
  });
});

// Gestion globale des erreurs
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Erreur interne du serveur'
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

module.exports = { app, server, io };

