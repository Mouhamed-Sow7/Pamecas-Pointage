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
const { initEmailCron } = require('./services/emailReports');


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

app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join_site', (siteCode) => {
    if (siteCode) socket.join(`site:${siteCode}`);
  });
});

connectDB();
initEmailCron();

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdn.jsdelivr.net"],
      // ✅ Fix: autoriser les event handlers inline (data-* via JS = ok, mais au cas où)
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"]
    },
  },
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Static client
const publicPath = path.join(__dirname, '..', 'client', 'public');
app.use(express.static(publicPath));

// Routes API
const agentsRouter = require('./routes/agents');
const authRouter = require('./routes/auth');
const pointagesRouter = require('./routes/pointages');
const sitesRouter = require('./routes/sites');
const rapportsRouter = require('./routes/rapports');

app.use('/api/auth', authRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/pointages', pointagesRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/rapports', rapportsRouter);

// ✅ SPA catch-all — uniquement pour les routes non-API et non-fichiers statiques
app.get('*', (req, res, next) => {
  // Ne pas intercepter les appels API ni les fichiers avec extension
  if (req.path.startsWith('/api/') || req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Erreurs globales
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