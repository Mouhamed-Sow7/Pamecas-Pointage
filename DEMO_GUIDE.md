# SmartPointage — Guide Démo & Documentation Technique
**Version :** v6 · Juin 2026  
**Projet :** SaaS pointage digital multi-tenant · PAMECAS Sénégal  
**Stack :** Node.js · Express · MongoDB Atlas · Vanilla JS PWA  
**URL prod :** https://smartpointage.digitalesf.com

---

## 1. Architecture de sécurité

### 1.1 Couches anti-fraude (de la plus forte à la plus faible)

| Couche | Mécanisme | Bypass possible ? |
|--------|-----------|-------------------|
| **QR Dynamique TOTP** | Code change toutes les 30s (HMAC-SHA256) | Non — sauf accès physique au téléphone |
| **Géofencing GPS** | Rayon 500m autour de l'agence (Haversine) | Spoofing GPS (dev tools) |
| **Session unique** | `session_token` en DB — 2e login invalide le 1er | Non |
| **Cooldown kiosque** | 60s entre deux scans du même agent | Non |
| **PIN kiosque rotatif** | Change toutes les 8h — admin only | Non si PIN null |
| **Capture silencieuse** | Photo au moment du pointage *(à implémenter)* | — |

### 1.2 Flux de pointage QR (kiosque)

```
Agent présente QR code
       ↓
jsQR décode le matricule
       ↓
Cooldown local 60s ? → OUI → Refus sonore
       ↓ NON
API POST /api/pointages
  ├─ Géofencing (coords kiosque vs coords agent)
  ├─ Vérif TOTP (window ±1)
  ├─ Cooldown serveur (last_scan_at)
  └─ Enregistrement + coordonnées GPS
       ↓
Beep arrivée/départ
Capture photo silencieuse *(à venir)*
Countdown 3s → reprise scan
```

### 1.3 TOTP Dynamique — implémentation
- Algorithme : `HMAC-SHA256(key="SP:{matricule}:{hex12}", data="{window}")`
- Window : `Math.floor(Date.now() / 30000)` — change toutes les 30s
- Tolérance : ±1 window (±30s) pour compenser la latence
- Recalcul côté client via `crypto.subtle` (offline compatible)

---

## 2. Comptes de démo

### Admin dashboard
| Login | Mot de passe | Rôle |
|-------|-------------|------|
| `admin` | `pamecas2024!` | Superadmin |
| `directeur.dakar` | `pamecas2024!` | Directeur régional |
| `admin.dg` | `pamecas2024!` | Admin PAM-DG |
| `point.dg` | `point2024!` | Pointeur PAM-DG |
| `admin.stl` | `pamecas2024!` | Admin PAM-STL |
| `point.stl` | `point2024!` | Pointeur PAM-STL |

### Portail agent
- Matricule : `SMP-0001` à `SMP-0082`
- Mot de passe : **4 derniers chiffres du matricule** (ex: `SMP-0001` → `0001`)

### God Mode (console F12)
```javascript
superadmin() // → saisir GOD_MODE_PASSWORD → JWT superadmin 24h
```

---

## 3. Scripts de test — Console F12

### 3.1 Géofencing

```javascript
// ── Simuler position DANS la zone (Agence Saint-Louis PAM-STL) ──
navigator.geolocation.getCurrentPosition = (success) => success({
  coords: { latitude: 16.024090, longitude: -16.494215, accuracy: 10 },
  timestamp: Date.now()
});
// Résultat attendu : pointage accepté ✅

// ── Simuler position HORS zone (Paris) ──
navigator.geolocation.getCurrentPosition = (success) => success({
  coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 10 },
  timestamp: Date.now()
});
// Résultat attendu : "Hors zone — vous êtes à Xm de l'agence (max 500m)" ❌

// ── Simuler position HORS zone (Dakar centre, ~300km de Saint-Louis) ──
navigator.geolocation.getCurrentPosition = (success) => success({
  coords: { latitude: 14.6937, longitude: -17.4441, accuracy: 10 },
  timestamp: Date.now()
});

// ── Annuler simulation → recharger la page ──
location.reload();
```

### 3.2 Générer un rapport mensuel avant la date

```javascript
// ── Forcer génération rapport mai 2026 (depuis console admin) ──
const token = localStorage.getItem('pamecas_token');
fetch('/api/rapports/mensuel', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mois: 5,      // mai
    annee: 2026,
    force: true   // bypass vérification date courante
  })
}).then(r => r.json()).then(console.log);
// Résultat : email envoyé + Excel en pièce jointe
```

### 3.3 Tester session unique agent

```javascript
// ── Depuis l'appareil A — vérifier session active ──
const token = localStorage.getItem('agent_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('session_id:', payload.session_id);
console.log('expire:', new Date(payload.exp * 1000));

// ── Simuler expiration session (depuis appareil B ou admin) ──
// Admin → dashboard → Agents → ouvrir modal → slide Portail → "Déconnecter la session"
// Appareil A : au prochain polling (30s), reçoit 401 → retour login automatique
```

### 3.4 Tester cooldown kiosque

```javascript
// ── Forcer reset cooldown local (pour retester) ──
// Dans la console du kiosque :
window._cooldownMap?.clear?.();
// ou recharger la page F5
```

### 3.5 Vérifier TOTP en temps réel

```javascript
// ── Générer le QR attendu pour un agent (même algo que le serveur) ──
async function testTOTP(matricule, secret) {
  const window30s = Math.floor(Date.now() / 30000);
  const key = `SP:${matricule}:${secret}`;
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(String(window30s)));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
  console.log(`QR attendu: ${matricule}:${hex.slice(0,8)}`);
  console.log(`Window: ${window30s} (expire dans ${30 - (Date.now()/1000 % 30)|0}s)`);
}
// Usage : testTOTP('SMP-0001', 'votre_secret_hex_12chars')
```

---

## 4. PIN kiosque rotatif — Spécification (à implémenter)

### Logique voulue (Option 3 — Hybride)

```
PIN généré automatiquement côté serveur toutes les 8h
PIN visible uniquement dans le dashboard admin (colonne "PIN" du tableau Sites)
Admin peut forcer rotation manuelle (bouton 🔄)
Agent ne voit jamais le PIN — il doit demander à l'admin pour sortir du kiosque
```

### Schéma Site.js à ajouter
```javascript
kiosque_pin: { type: String, default: null },
kiosque_pin_expires_at: { type: Date, default: null },
kiosque_pin_history: [{ pin: String, created_at: Date }] // audit
```

### Route à créer : POST /api/sites/:id/rotate-pin
```javascript
// Génère un PIN aléatoire 6 chiffres + date expiration +8h
const pin = Math.floor(100000 + Math.random() * 900000).toString();
const expires = new Date(Date.now() + 8 * 60 * 60 * 1000);
await Site.findByIdAndUpdate(id, {
  kiosque_pin: pin,
  kiosque_pin_expires_at: expires
});
```

### Rotation automatique (cron dans seed.js ou app.js)
```javascript
// Toutes les 8h — rotate les PINs expirés
setInterval(async () => {
  const expired = await Site.find({
    kiosque_pin_expires_at: { $lt: new Date() },
    kiosque_pin: { $ne: null }
  });
  for (const site of expired) {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    await Site.findByIdAndUpdate(site._id, {
      kiosque_pin: pin,
      kiosque_pin_expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000)
    });
  }
}, 30 * 60 * 1000); // vérif toutes les 30min
```

### Affichage dans le tableau Sites (dashboard admin)
```
| Code     | Nom              | ... | PIN kiosque        | Actions |
|----------|------------------|-----|--------------------|---------|
| PAM-STL  | Agence Saint-Louis | ... | 🔐 4 8 2 9 1 7  🔄 | ...    |
|          |                  |     | Expire dans 3h12   |         |
```

---

## 5. Capture silencieuse — Spécification (à implémenter)

### Principe
Au moment du scan QR validé, capturer une frame de la webcam kiosque et l'associer au pointage. Visible par l'admin en cas de litige.

### Champ à ajouter dans Pointage.js
```javascript
photo_pointage: {
  type: String, // base64 JPEG compressé ou URL Cloudinary
  default: null
}
```

### Implémentation dans kiosque.js (après `enregistrerCooldownLocal`)
```javascript
async function capturerPhotoPointage(video) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 320;  // résolution réduite
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 320, 240);
    return canvas.toDataURL('image/jpeg', 0.6); // qualité 60%
  } catch(e) {
    return null; // silencieux — ne bloque pas le pointage
  }
}

// Dans onQRDetected, après enregistrerCooldownLocal() :
const photo = await capturerPhotoPointage(video);
if (photo) {
  // Envoyer en background (non bloquant)
  fetch(`/api/pointages/${result.pointage_id}/photo`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_pointage: photo })
  }).catch(() => {}); // silencieux
}
```

### Contraintes
- Ne jamais bloquer le flux de pointage si la capture échoue
- Compresser en JPEG 320×240 @ 60% = ~15-20 Ko par pointage
- Option : stocker sur Cloudinary plutôt qu'en base64 MongoDB (limite 16MB/doc)

---

## 6. Parcours de démo PAMECAS — Script présentateur

### Durée estimée : 12-15 minutes

**[0:00] Connexion admin**
- URL : `https://smartpointage.digitalesf.com`
- Login : `admin` / `pamecas2024!`
- Montrer : dashboard global, badge multi-agences, graphiques temps réel

**[2:00] Gestion agents**
- Menu Agents → liste des 82 agents
- Ouvrir agent `SMP-0001` Mamadou Diallo
- Montrer les 3 slides : Identité · Portail · QR Code
- Activer/désactiver QR dynamique TOTP

**[4:00] Portail agent (mobile)**
- Ouvrir sur téléphone : `https://smartpointage.digitalesf.com/agent`
- Login : `SMP-0001` / `0001`
- Montrer : badge QR dynamique (compte à rebours 30s), stats, congés

**[6:00] Kiosque pointage**
- Menu Sites → PAM-STL → "Déployer kiosque"
- Scanner le QR de l'agent → beep arrivée
- Montrer le cooldown 60s anti-fraude

**[8:00] Géofencing**
- Depuis la console F12, simuler position Paris
- Rescanner → message "Hors zone"
- Remettre position Saint-Louis → pointage accepté

**[10:00] Rapport mensuel**
- Menu Rapports → Rapport mensuel
- Générer → Excel brandé PAMECAS en pièce jointe email

**[12:00] Congés**
- Portail agent → onglet Congés → soumettre demande
- Dashboard admin → valider la demande

**[14:00] Sécurité — session unique**
- Montrer 2 onglets avec le même compte agent
- Connexion sur onglet B → onglet A déconnecté automatiquement

---

## 7. Variables d'environnement Render

```env
MONGO_URI=...
JWT_SECRET=...
NODE_ENV=production
PORT=10000
GMAIL_USER=noreply@digitalesf.com
GMAIL_APP_PASSWORD=...
BREVO_API_KEY=xkeysib-...
REPORT_EMAIL_TO=mouhamed.sow7@unchk.edu.sn
GOD_MODE_PASSWORD=...
```

---

## 8. Commandes utiles

```bash
# Démarrage local
node server/seed.js && node server/app.js

# Reset complet BDD (reseed)
node server/seed.js

# Git workflow avec Claude sandbox
# Claude modifie directement depuis sandbox et push via token GitHub
```

---

*Document généré le 16 juin 2026 — Session v6 SmartPointage*
