const { generateQRData, validateQRData, getTimeWindow } = require("./totp");

const SECRET = "test-secret-123";
const MATRICULE = "SMP-0001";

describe("getTimeWindow()", () => {
  test("retourne un entier pour le timestamp courant", () => {
    const w = getTimeWindow();
    expect(Number.isInteger(w)).toBe(true);
    expect(w).toBeGreaterThan(0);
  });

  test("retourne la fenêtre correcte pour un timestamp donné", () => {
    const ts = 1; // 1ms après epoch
    expect(getTimeWindow(ts)).toBe(0);

    const ts30 = 30_000; // 30s après epoch
    expect(getTimeWindow(ts30)).toBe(1);

    const ts60 = 60_000; // 60s après epoch
    expect(getTimeWindow(ts60)).toBe(2);
  });
});

describe("generateQRData()", () => {
  test("retourne le format SP:{matricule}:{hex12}:{window}", () => {
    const qr = generateQRData(MATRICULE, SECRET);
    const parts = qr.split(":");

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("SP");
    expect(parts[1]).toBe(MATRICULE);
    expect(parts[2]).toMatch(/^[0-9a-f]{12}$/);
    expect(Number.isInteger(Number(parts[3]))).toBe(true);
  });

  test("produit des tokens différents pour des matricules différents", () => {
    const qr1 = generateQRData("SMP-0001", SECRET);
    const qr2 = generateQRData("SMP-0002", SECRET);
    expect(qr1).not.toBe(qr2);
  });

  test("produit des tokens différents pour des secrets différents", () => {
    const qr1 = generateQRData(MATRICULE, "secret-a");
    const qr2 = generateQRData(MATRICULE, "secret-b");
    expect(qr1).not.toBe(qr2);
  });

  test("le token hex fait exactement 12 caractères", () => {
    const qr = generateQRData(MATRICULE, SECRET);
    const token = qr.split(":")[2];
    expect(token).toHaveLength(12);
  });
});

describe("validateQRData()", () => {
  test("valide un QR code fraîchement généré", () => {
    const qr = generateQRData(MATRICULE, SECRET);
    const result = validateQRData(qr, MATRICULE, SECRET);
    expect(result.valid).toBe(true);
    expect(result.matricule).toBe(MATRICULE);
  });

  test("rejette un format invalide (pas de préfixe SP)", () => {
    const result = validateQRData("INVALID:abc:123:456", MATRICULE, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Format invalide");
  });

  test("rejette un format invalide (mauvais nombre de parties)", () => {
    const result = validateQRData("SP:abc:123", MATRICULE, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Format invalide");
  });

  test("rejette un matricule incorrect", () => {
    const qr = generateQRData(MATRICULE, SECRET);
    const result = validateQRData(qr, "SMP-9999", SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Matricule incorrect");
  });

  test("rejette un code expiré (hors fenêtre de tolérance)", () => {
    // On génère un QR pour une fenêtre passée (window - 2)
    const oldWindow = getTimeWindow() - 2;
    // On reconstruit manuellement un QR avec cette vieille fenêtre
    const crypto = require("crypto");
    const message = `${MATRICULE}:${oldWindow}`;
    const oldToken = crypto
      .createHmac("sha256", SECRET)
      .update(message)
      .digest("hex")
      .substring(0, 12);
    const oldQR = `SP:${MATRICULE}:${oldToken}:${oldWindow}`;

    const result = validateQRData(oldQR, MATRICULE, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Code expire ou invalide");
  });

  test("valide un QR de la fenêtre précédente (tolérance -1)", () => {
    const crypto = require("crypto");
    const prevWindow = getTimeWindow() - 1;
    const message = `${MATRICULE}:${prevWindow}`;
    const prevToken = crypto
      .createHmac("sha256", SECRET)
      .update(message)
      .digest("hex")
      .substring(0, 12);
    const prevQR = `SP:${MATRICULE}:${prevToken}:${prevWindow}`;

    const result = validateQRData(prevQR, MATRICULE, SECRET);
    expect(result.valid).toBe(true);
  });
});