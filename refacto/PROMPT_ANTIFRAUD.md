# SmartPointage — Anti-fraude : Cooldown 1min + Sons distincts

## Contexte
Lire kiosque.js avant de modifier. Ne pas casser la logique existante.

---

## MISSION 1 — Cooldown 1 minute côté backend

### server/routes/pointages.js
Dans le POST /, après avoir trouvé ou non le pointage existant, ajouter cette vérification AVANT d'enregistrer :

```javascript
// Cooldown anti-fraude : 1 minute entre deux scans du même agent
const maintenant = new Date();
const uneMinuteAvant = new Date(maintenant.getTime() - 60 * 1000);

// Vérifier dans un champ last_scan_at sur le pointage
if (pointage && pointage.last_scan_at && pointage.last_scan_at > uneMinuteAvant) {
  const resteSecondes = Math.ceil((pointage.last_scan_at - uneMinuteAvant) / 1000);
  return res.status(429).json({
    message: `Scan trop rapide. Attendez ${resteSecondes} seconde(s).`,
    cooldown: true,
    reste_secondes: resteSecondes
  });
}
```

Mettre à jour `last_scan_at` à chaque scan réussi :
```javascript
pointage.last_scan_at = new Date();
await pointage.save();
```

### server/models/Pointage.js
Ajouter le champ :
```javascript
last_scan_at: {
  type: Date,
  default: null
}
```

---

## MISSION 2 — Sons distincts dans kiosque.js

### client/public/src/pages/kiosque.js

Remplacer la fonction `playBeep` existante par cette version complète avec 4 sons :

```javascript
function playBeep(type = 'arrivee') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    function note(freq, debut, duree, gain = 0.3, forme = 'sine') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.type = forme;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + debut);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + debut + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + debut + duree);
      osc.start(ctx.currentTime + debut);
      osc.stop(ctx.currentTime + debut + duree + 0.05);
    }

    if (type === 'arrivee') {
      // Bip aigu court montant — confirmation positive
      note(660, 0,    0.12, 0.25);
      note(880, 0.13, 0.18, 0.3);

    } else if (type === 'depart') {
      // Double bip moyen descendant — départ validé
      note(660, 0,    0.12, 0.25);
      note(520, 0.18, 0.18, 0.25);

    } else if (type === 'cooldown') {
      // Triple bip rapide medium — tentative trop rapide
      note(440, 0,    0.08, 0.2);
      note(440, 0.10, 0.08, 0.2);
      note(440, 0.20, 0.08, 0.2);

    } else if (type === 'erreur') {
      // Son grave long — erreur sérieuse
      note(180, 0, 0.6, 0.35, 'sawtooth');
      note(150, 0.3, 0.4, 0.2, 'sawtooth');
    }
  } catch (e) {}
}
```

---

## MISSION 3 — Gérer le cooldown dans kiosque.js

### client/public/src/pages/kiosque.js

Dans la fonction `onQRDetected`, modifier la gestion des erreurs pour détecter le cooldown :

```javascript
} catch (err) {
  // Détecter cooldown vs erreur normale
  if (err.message && err.message.includes('Scan trop rapide')) {
    playBeep('cooldown');
    setEtat(root, 'erreur', { message: err.message, icon: 'fa-clock', color: '#e65100' });
  } else {
    playBeep('erreur');
    setEtat(root, 'erreur', { message: err.message || 'Erreur inconnue' });
  }
  startCountdown(root, 2, () => resumeScanner(root, video, canvas, token, siteId, onQRDetected));
}
```

Modifier aussi `setEtat` pour le cas erreur avec icône et couleur personnalisables :

```javascript
} else if (etat === 'erreur') {
  const icon = data.icon || 'fa-triangle-exclamation';
  const color = data.color || '#c62828';
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div style="text-align:center;animation:fadeInUp 0.3s ease;">
      <div style="width:70px;height:70px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
        <i class="fa-solid ${icon}" style="font-size:1.8rem;color:white;"></i>
      </div>
      <div style="color:white;font-size:1.1rem;font-weight:600;margin-bottom:8px;">${data.message || 'Erreur'}</div>
      <div style="color:rgba(255,255,255,0.6);font-size:0.8rem;" id="kiosque-countdown">Nouvelle tentative dans 2s...</div>
    </div>
  `;
}
```

Modifier `setEtat succes` pour passer le bon type de son :

```javascript
// Après avoir enregistré avec succès
playBeep(type); // 'arrivee' ou 'depart'
setEtat(root, 'succes', { agent, type });
```

---

## MISSION 4 — Cooldown côté frontend aussi (double protection)

### client/public/src/pages/kiosque.js

Ajouter un Map de cooldown local pour éviter même les requêtes réseau inutiles :

```javascript
// En haut du fichier, après les variables globales
const cooldownMap = new Map(); // agentId -> timestamp dernier scan

function verifierCooldownLocal(agentId) {
  const dernierScan = cooldownMap.get(agentId);
  if (!dernierScan) return null;
  const deltaMs = Date.now() - dernierScan;
  if (deltaMs < 60000) {
    return Math.ceil((60000 - deltaMs) / 1000);
  }
  return null;
}

function enregistrerCooldownLocal(agentId) {
  cooldownMap.set(agentId, Date.now());
}
```

Dans `onQRDetected`, après avoir trouvé l'agent, vérifier le cooldown local AVANT l'appel API :

```javascript
const agentId = (agent._id || agent.id).toString();
const resteSecondes = verifierCooldownLocal(agentId);
if (resteSecondes) {
  playBeep('cooldown');
  setEtat(root, 'erreur', {
    message: `Scan trop rapide. Attendez ${resteSecondes}s.`,
    icon: 'fa-clock',
    color: '#e65100'
  });
  startCountdown(root, 2, () => resumeScanner(root, video, canvas, token, siteId, onQRDetected));
  return;
}

// Après scan réussi, enregistrer cooldown local
enregistrerCooldownLocal(agentId);
```

---

## Commit

```bash
git add .
git commit -m "feat: anti-fraude cooldown 1min + sons distincts arrivee/depart/cooldown/erreur"
git push
```

---

## Résumé des sons

| Scénario | Son | Fréquences |
|----------|-----|------------|
| Arrivée validée | 2 bips aigus montants | 660Hz → 880Hz |
| Départ validé | 2 bips descendants | 660Hz → 520Hz |
| Scan trop rapide | 3 bips rapides | 440Hz x3 |
| Erreur grave | Son grave long | 180Hz sawtooth |

## Cooldown double protection
- **Frontend** : Map local, bloque avant même l'appel API
- **Backend** : Champ `last_scan_at` en DB, protection définitive même si frontend contourné
