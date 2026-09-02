const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

const { connectDB } = require("./config/db");
const { initEmailCron } = require("./services/emailReports");

dotenv.config();

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  socket.on("join_site", (siteCode) => {
    if (siteCode) socket.join(`site:${siteCode}`);
  });
});

connectDB();
initEmailCron();

// ── Cron rotation PIN kiosque — toutes les 30min, rotate les PINs expirés ──
(async function initPinRotationCron() {
  const Site = require("./models/Site");
  async function rotateExpiredPins() {
    try {
      const now = new Date();
      const expired = await Site.find({
        kiosque_pin: { $ne: null },
        kiosque_pin_expires_at: { $lt: now },
      });
      for (const site of expired) {
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        await Site.findByIdAndUpdate(site._id, {
          kiosque_pin: pin,
          kiosque_pin_expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000),
          kiosque_pin_rotated_at: now,
        });
        console.log(`[PIN] Rotation automatique → ${site.nom} : ${pin}`);
      }
    } catch (e) {
      console.error("[PIN] Erreur rotation:", e.message);
    }
  }
  // Lancer après 5s (DB connectée) puis toutes les 30min
  setTimeout(() => {
    rotateExpiredPins();
    setInterval(rotateExpiredPins, 30 * 60 * 1000);
  }, 5000);
})();

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-hashes'",
          "https://cdn.jsdelivr.net",
        ],
        // ✅ Fix: autoriser les event handlers inline (data-* via JS = ok, mais au cas où)
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: [
          "'self'",
          "ws:",
          "wss:",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net",
        ],
      },
    },
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Static files
const publicPath = path.join(__dirname, "..", "client", "public");
const landingPath = path.join(__dirname, "..", "landing");
const adminPath  = path.join(__dirname, "..", "admin");

// Landing → racine /
app.use("/", express.static(landingPath));

// Admin SaaS → /admin
app.use("/admin", express.static(adminPath));

// App cliente → /app
app.use("/app", express.static(publicPath));

// Compat rétrocompatibilité : les assets CSS/JS/vendor de l'app restent accessibles à la racine
app.use(express.static(publicPath));

// Routes API
const agentsRouter = require("./routes/agents");
const authRouter = require("./routes/auth");
const pointagesRouter = require("./routes/pointages");
const sitesRouter = require("./routes/sites");
const rapportsRouter = require("./routes/rapports");
const usersRouter = require("./routes/users");
const adminRouter = require("./routes/admin");
const agentPortalRouter = require("./routes/agent-portal");
const congesRouter = require("./routes/conges");
const passkeyRouter = require("./routes/passkey");

app.use("/api/auth", authRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/pointages", pointagesRouter);
app.use("/api/sites", sitesRouter);
app.use("/api/rapports", rapportsRouter);
app.use("/api/users", usersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/agent-portal", agentPortalRouter);
app.use("/api/conges", congesRouter);
app.use("/api/passkey", passkeyRouter);

// ── Health check — keep-alive pour Render free tier ─────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// Servir agent.html sur /agent
app.get("/agent", (req, res) => {
  res.sendFile(path.join(publicPath, "agent.html"));
});

// Servir kiosk.html sur /kiosk (PWA kiosque indépendant)
app.get("/kiosk", (req, res) => {
  res.sendFile(path.join(publicPath, "kiosk.html"));
});

// SPA app cliente — toutes les routes /app/* → index.html de l'app
app.get("/app/*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Compat : les anciens hash-routes (#/dashboard etc.) fonctionnaient sur /
// On redirige / vers /app si ce n'est pas un asset statique
app.get("/", (req, res) => {
  res.sendFile(path.join(landingPath, "index.html"));
});

// ✅ SPA catch-all — uniquement pour les routes non-API et non-fichiers statiques
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.includes(".")) {
    return next();
  }
  // Routes de l'admin panel
  if (req.path.startsWith("/admin")) {
    return res.sendFile(path.join(adminPath, "index.html"));
  }
  // Tout le reste → app SPA
  res.sendFile(path.join(publicPath, "index.html"));
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Route non trouvée" });
});

// Erreurs globales
app.use((err, req, res, next) => {
  console.error("❌ Erreur serveur:", err);
  res.status(err.status || 500).json({
    message: err.message || "Erreur interne du serveur",
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

module.exports = { app, server, io };
