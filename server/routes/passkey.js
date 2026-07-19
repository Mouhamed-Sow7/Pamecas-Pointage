/**
 * routes/passkey.js — WebAuthn / Passkeys pour agents SmartPointage
 *
 * Endpoints :
 *   POST /api/passkey/register/options     → génère le challenge d'enregistrement
 *   POST /api/passkey/register/verify      → vérifie et stocke le credential
 *   POST /api/passkey/auth/options         → génère le challenge d'authentification
 *   POST /api/passkey/auth/verify          → vérifie la signature biométrique
 *   GET  /api/passkey/devices              → liste les appareils de l'agent
 *   DELETE /api/passkey/devices/:id        → révoque un appareil (admin ou agent lui-même)
 */

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const Agent = require("../models/Agent");
const Device = require("../models/Device");
const { authenticate, authorizeRoles } = require("../middleware/auth");

// ── Config WebAuthn ──────────────────────────────────────────────────────────
const RP_NAME = "SmartPointage";
// En prod on utilise le vrai domaine ; en dev localhost
const RP_ID = process.env.WEBAUTHN_RP_ID || "smartpointage.digitalesf.com";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "https://smartpointage.digitalesf.com";

// Store temporaire en mémoire pour les challenges (TTL 5 min)
// En production on peut utiliser Redis, mais pour un SaaS Sénégal ça suffit
const challengeStore = new Map();
const CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes

function storeChallenge(agentId, challenge) {
  challengeStore.set(agentId.toString(), {
    challenge,
    expires: Date.now() + CHALLENGE_TTL,
  });
}

function getChallenge(agentId) {
  const entry = challengeStore.get(agentId.toString());
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    challengeStore.delete(agentId.toString());
    return null;
  }
  return entry.challenge;
}

function clearChallenge(agentId) {
  challengeStore.delete(agentId.toString());
}

// ── Middleware auth agent (JWT Bearer) ───────────────────────────────────────
async function authenticateAgent(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token agent requis" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    if (decoded.role !== "agent") {
      return res.status(403).json({ message: "Accès réservé aux agents" });
    }
    const agent = await Agent.findById(decoded.id).select(
      "matricule nom prenom instance_slug session_token"
    );
    if (!agent) return res.status(401).json({ message: "Agent introuvable" });
    if (decoded.session_id !== agent.session_token) {
      return res.status(401).json({ error: "SESSION_EXPIRED" });
    }
    req.agent = agent;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalide" });
  }
}

// ── Helper : nom d'appareil depuis User-Agent ────────────────────────────────
function parseDeviceName(userAgent = "") {
  if (/iphone/i.test(userAgent)) return "iPhone";
  if (/ipad/i.test(userAgent)) return "iPad";
  if (/samsung/i.test(userAgent)) return "Samsung";
  if (/android/i.test(userAgent)) return "Android";
  if (/windows/i.test(userAgent)) return "Windows PC";
  if (/macintosh/i.test(userAgent)) return "Mac";
  return "Appareil inconnu";
}

// ════════════════════════════════════════════════════════════════════════════
// ENREGISTREMENT
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/passkey/register/options
 * Corps : { } (token agent en Bearer)
 * Retourne les options WebAuthn pour startRegistration()
 */
router.post("/register/options", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;

    // Récupérer les credentials déjà enregistrés pour cet agent
    const existingDevices = await Device.find({
      agent_id: agent._id,
      status: "active",
    }).select("credential_id transports");

    const excludeCredentials = existingDevices.map((d) => ({
      id: d.credential_id,
      transports: d.transports,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(agent._id.toString(), "utf-8"),
      userName: agent.matricule,
      userDisplayName: `${agent.prenom} ${agent.nom}`,

      // ── Forcer UNIQUEMENT biométrie — pas de PIN, pas de clé USB ──
      authenticatorSelection: {
        authenticatorAttachment: "platform",   // intégré au téléphone uniquement
        userVerification: "required",          // biométrie obligatoire
        residentKey: "required",
      },

      // Exclure les appareils déjà enregistrés
      excludeCredentials,

      // Algorithmes supportés (ES256 + RS256)
      supportedAlgorithmIDs: [-7, -257],

      timeout: 60000,
    });

    // Stocker le challenge temporairement
    storeChallenge(agent._id, options.challenge);

    res.json(options);
  } catch (err) {
    console.error("Passkey register/options error:", err);
    res.status(500).json({ message: "Erreur génération options" });
  }
});

/**
 * POST /api/passkey/register/verify
 * Corps : credential WebAuthn retourné par startRegistration()
 */
router.post("/register/verify", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const credential = req.body;

    const expectedChallenge = getChallenge(agent._id);
    if (!expectedChallenge) {
      return res.status(400).json({ message: "Challenge expiré, recommencez." });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true, // biométrie obligatoire
    });

    clearChallenge(agent._id);

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ message: "Vérification biométrique échouée." });
    }

    const { credential: cred } = verification.registrationInfo;
    if (!cred || !cred.id || !cred.publicKey) {
      return res.status(400).json({ message: "Credential incomplet reçu de l'appareil." });
    }

    // Sauvegarder l'appareil
    const deviceName = parseDeviceName(req.headers["user-agent"]);
    const device = await Device.create({
      agent_id: agent._id,
      instance_slug: agent.instance_slug,
      credential_id: cred.id,
      public_key: Buffer.from(cred.publicKey).toString("base64"),
      counter: cred.counter,
      device_name: deviceName,
      transports: credential.response?.transports || [],
      status: "active",
      last_used_at: new Date(),
    });

    res.json({
      verified: true,
      device: {
        id: device._id,
        name: device.device_name,
        created_at: device.createdAt,
      },
    });
  } catch (err) {
    console.error("Passkey register/verify error:", err);
    // Credential déjà enregistré
    if (err.code === 11000) {
      return res.status(409).json({ message: "Cet appareil est déjà enregistré." });
    }
    res.status(500).json({ message: err.message || "Erreur vérification" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// AUTHENTIFICATION (challenge biométrique avant pointage)
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/passkey/auth/options
 * Génère un challenge à signer avec la biométrie de l'agent
 */
router.post("/auth/options", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;

    const devices = await Device.find({
      agent_id: agent._id,
      status: "active",
    }).select("credential_id transports");

    if (devices.length === 0) {
      return res.status(404).json({
        error: "NO_PASSKEY",
        message: "Aucun appareil biométrique enregistré.",
      });
    }

    const allowCredentials = devices.map((d) => ({
      id: d.credential_id,
      transports: d.transports,
    }));

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: "required", // biométrie obligatoire — pas de PIN
      timeout: 60000,
    });

    storeChallenge(agent._id, options.challenge);

    res.json(options);
  } catch (err) {
    console.error("Passkey auth/options error:", err);
    res.status(500).json({ message: "Erreur génération challenge" });
  }
});

/**
 * POST /api/passkey/auth/verify
 * Vérifie la signature biométrique — retourne un token de pointage à usage unique
 */
router.post("/auth/verify", authenticateAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const credential = req.body;

    const expectedChallenge = getChallenge(agent._id);
    if (!expectedChallenge) {
      return res.status(400).json({ message: "Challenge expiré, recommencez." });
    }

    // Trouver le device correspondant
    const device = await Device.findOne({
      agent_id: agent._id,
      credential_id: credential.id,
      status: "active",
    });

    if (!device) {
      return res.status(404).json({ message: "Appareil non reconnu ou révoqué." });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: device.credential_id,
        publicKey: Buffer.from(device.public_key, "base64"),
        counter: device.counter,
        transports: device.transports,
      },
    });

    clearChallenge(agent._id);

    if (!verification.verified) {
      return res.status(400).json({ message: "Vérification biométrique échouée." });
    }

    // Mise à jour du compteur anti-clonage
    device.counter = verification.authenticationInfo.newCounter;
    device.last_used_at = new Date();
    await device.save();

    // Token biométrique à usage unique (valide 2 minutes — juste pour le pointage)
    const bioToken = jwt.sign(
      {
        agent_id: agent._id,
        biometric: true,
        device_id: device._id,
        purpose: "pointage",
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "2m" }
    );

    res.json({
      verified: true,
      bio_token: bioToken,
      device_name: device.device_name,
    });
  } catch (err) {
    console.error("Passkey auth/verify error:", err);
    res.status(500).json({ message: err.message || "Erreur vérification biométrique" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// GESTION APPAREILS
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/passkey/devices
 * Liste les appareils de l'agent connecté
 */
router.get("/devices", authenticateAgent, async (req, res) => {
  try {
    const devices = await Device.find({
      agent_id: req.agent._id,
    }).select("device_name status last_used_at createdAt transports");

    res.json({ data: devices });
  } catch (err) {
    res.status(500).json({ message: "Erreur chargement appareils" });
  }
});

/**
 * DELETE /api/passkey/devices/:id
 * Révoque un appareil — accessible à l'agent lui-même OU à un admin
 */
router.delete("/devices/:id", authenticateAgent, async (req, res) => {
  try {
    const device = await Device.findOne({
      _id: req.params.id,
      agent_id: req.agent._id,
    });

    if (!device) {
      return res.status(404).json({ message: "Appareil introuvable." });
    }

    device.status = "revoked";
    await device.save();

    res.json({ message: "Appareil révoqué. L'agent devra se réenregistrer." });
  } catch (err) {
    res.status(500).json({ message: "Erreur révocation" });
  }
});

/**
 * DELETE /api/passkey/admin/agents/:agentId/devices
 * Révoque TOUS les appareils d'un agent — admin/superadmin uniquement
 */
router.delete(
  "/admin/agents/:agentId/devices",
  authenticate,
  authorizeRoles("admin", "superadmin"),
  async (req, res) => {
    try {
      await Device.updateMany(
        { agent_id: req.params.agentId },
        { status: "revoked" }
      );
      res.json({ message: "Tous les appareils de cet agent ont été révoqués." });
    } catch (err) {
      res.status(500).json({ message: "Erreur révocation" });
    }
  }
);

/**
 * GET /api/passkey/admin/agents/:agentId/devices
 * Voir les appareils d'un agent — admin/superadmin
 */
router.get(
  "/admin/agents/:agentId/devices",
  authenticate,
  authorizeRoles("admin", "superadmin", "directeur_regional"),
  async (req, res) => {
    try {
      const devices = await Device.find({ agent_id: req.params.agentId })
        .select("device_name status last_used_at createdAt")
        .sort({ createdAt: -1 });

      res.json({ data: devices });
    } catch (err) {
      res.status(500).json({ message: "Erreur chargement" });
    }
  }
);

module.exports = router;
