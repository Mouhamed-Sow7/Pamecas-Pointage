const crypto = require("crypto");

// Fenêtre de 20 secondes (code plus court = moins d'exposition en cas de
// regard indiscret / capture d'écran, sans gêner le scan normal grâce à la
// tolérance ci-dessous)
const WINDOW_SECONDS = 20;
// Tolérance : fenêtre courante + précédente
const TOLERANCE = 1;

function getTimeWindow(timestamp) {
  return Math.floor((timestamp || Date.now()) / (WINDOW_SECONDS * 1000));
}

function generateToken(matricule, secret, window) {
  const message = `${matricule}:${window}`;
  return crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex")
    .substring(0, 12);
}

function generateQRData(matricule, secret) {
  const window = getTimeWindow();
  const token = generateToken(matricule, secret, window);
  return `SP:${matricule}:${token}:${window}`;
}

function validateQRData(qrData, matricule, secret) {
  const parts = qrData.split(":");
  if (parts.length !== 4 || parts[0] !== "SP") {
    return { valid: false, reason: "Format invalide" };
  }

  const [, scannedMatricule, scannedToken, scannedWindow] = parts;

  if (scannedMatricule.toUpperCase() !== matricule.toUpperCase()) {
    return { valid: false, reason: "Matricule incorrect" };
  }

  const currentWindow = getTimeWindow();

  for (let offset = 0; offset <= TOLERANCE; offset++) {
    const checkWindow = currentWindow - offset;
    const expectedToken = generateToken(matricule, secret, checkWindow);
    if (scannedToken === expectedToken) {
      return { valid: true, matricule };
    }
  }

  return { valid: false, reason: "Code expire ou invalide" };
}

// Validation "différée" — utilisée à la synchronisation offline.
// Contrairement à validateQRData(), on NE compare PAS à la fenêtre
// temporelle actuelle (le scan a pu avoir lieu des heures plus tôt,
// hors ligne). On revalide plutôt que le token correspond bien au
// HMAC attendu POUR LA FENÊTRE REVENDIQUÉE dans le QR lui-même.
// Ça prouve que le token a été généré par quelqu'un qui possédait le
// secret de l'agent à ce moment-là (donc pas forgé a posteriori),
// même si on ne peut plus garantir la fraîcheur/anti-rejeu à ce stade.
function validateQRDataOffline(qrData, matricule, secret) {
  const parts = (qrData || "").split(":");
  if (parts.length !== 4 || parts[0] !== "SP") {
    return { valid: false, reason: "Format invalide" };
  }

  const [, scannedMatricule, scannedToken, scannedWindowStr] = parts;

  if (scannedMatricule.toUpperCase() !== matricule.toUpperCase()) {
    return { valid: false, reason: "Matricule incorrect" };
  }

  const scannedWindow = Number(scannedWindowStr);
  if (!Number.isFinite(scannedWindow)) {
    return { valid: false, reason: "Fenêtre temporelle invalide" };
  }

  const expectedToken = generateToken(matricule, secret, scannedWindow);
  if (scannedToken !== expectedToken) {
    return { valid: false, reason: "Token falsifié ou secret incorrect" };
  }

  return { valid: true, matricule, window: scannedWindow };
}

module.exports = {
  generateQRData,
  validateQRData,
  validateQRDataOffline,
  getTimeWindow,
};
