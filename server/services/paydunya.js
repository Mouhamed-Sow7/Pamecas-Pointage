// ─── Service PayDunya ──────────────────────────────────────────────
// Doc officielle : https://developers.paydunya.com/
//
// Mode sandbox par défaut tant que PAYDUNYA_MODE n'est pas explicitement
// "live" dans les variables d'environnement — évite qu'un oubli de config
// ne bascule accidentellement en facturation réelle.
//
// Variables d'environnement attendues :
//   PAYDUNYA_MASTER_KEY
//   PAYDUNYA_PRIVATE_KEY   (test_private_... en sandbox, live_private_... en prod)
//   PAYDUNYA_PUBLIC_KEY
//   PAYDUNYA_TOKEN
//   PAYDUNYA_MODE          ("test" par défaut, "live" pour la prod)
//   APP_URL                (deja utilise ailleurs dans le projet, sert a batir
//                           les URLs de callback/retour)

const MODE = (process.env.PAYDUNYA_MODE || "test").toLowerCase();
const BASE_URL =
  MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

function headers() {
  return {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY,
    "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY,
    "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN,
  };
}

function configOk() {
  return !!(
    process.env.PAYDUNYA_MASTER_KEY &&
    process.env.PAYDUNYA_PRIVATE_KEY &&
    process.env.PAYDUNYA_TOKEN
  );
}

/**
 * Crée une facture PayDunya (checkout invoice) et renvoie l'URL de paiement
 * à laquelle rediriger le client, ainsi que le token de la facture.
 *
 * @param {number} montant - Montant total en FCFA (entier, jamais decimal)
 * @param {string} description
 * @param {object} customData - donnees libres qu'on veut recuperer dans l'IPN
 *   (ex: { tenant_slug, plan_vise }) — jamais affichees au client
 * @param {string} callbackUrl - URL de notre webhook IPN
 * @param {string} [returnUrl] - URL de retour apres paiement reussi
 */
async function creerFacture({
  montant,
  description,
  customData,
  callbackUrl,
  returnUrl,
}) {
  if (!configOk()) {
    throw new Error(
      "PayDunya n'est pas configuré (clés API manquantes en variables d'environnement).",
    );
  }
  if (!Number.isInteger(montant) || montant <= 0) {
    throw new Error("Montant de facture invalide.");
  }

  const body = {
    invoice: {
      total_amount: montant,
      description,
    },
    store: {
      name: "SmartPointage",
    },
    actions: {
      callback_url: callbackUrl,
      ...(returnUrl ? { return_url: returnUrl } : {}),
    },
    custom_data: customData || {},
  };

  const res = await fetch(`${BASE_URL}/checkout-invoice/create`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (data.response_code !== "00") {
    throw new Error(
      data.response_text || "Erreur lors de la création de la facture PayDunya.",
    );
  }

  return {
    token: data.token,
    checkoutUrl: data.response_text, // PayDunya renvoie l'URL dans response_text
    mode: MODE,
  };
}

/**
 * Re-confirme le statut d'une facture directement auprès des serveurs
 * PayDunya (appel serveur-à-serveur). A utiliser TOUJOURS après réception
 * d'un IPN, plutôt que de faire confiance au seul contenu du webhook —
 * la vérification par hash de PayDunya est un hash statique de notre clé
 * (pas un HMAC du contenu), donc un attaquant qui connaîtrait ce hash
 * pourrait rejouer une notification. Cette confirmation ferme la faille.
 */
async function confirmerFacture(token) {
  if (!configOk()) {
    throw new Error("PayDunya n'est pas configuré.");
  }
  const res = await fetch(`${BASE_URL}/checkout-invoice/confirm/${token}`, {
    method: "GET",
    headers: headers(),
  });
  return res.json();
}

/**
 * Vérifie que le hash reçu dans l'IPN correspond bien à notre Master Key.
 * Méthode documentée par PayDunya : hash = SHA-512(MASTER_KEY).
 */
function verifierHashIpn(hashRecu) {
  const crypto = require("crypto");
  const attendu = crypto
    .createHash("sha512")
    .update(process.env.PAYDUNYA_MASTER_KEY || "")
    .digest("hex");
  return hashRecu === attendu;
}

module.exports = { creerFacture, confirmerFacture, verifierHashIpn, MODE };
