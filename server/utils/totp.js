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

module.exports = { generateQRData, validateQRData, getTimeWindow };
