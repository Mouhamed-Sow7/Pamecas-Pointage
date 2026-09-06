# SmartPointage — Scénario de Démo

> **Durée :** 20 minutes  
> **Public :** Client existant (PAMECAS) + Prospect (découverte offre)  
> **Prérequis :** `npm run seed && npm run seed:cms && npm run seed:gmv && npm run seed:demo`
> **⚠️ Corrigé le 6 sept. 2026** : logins/URL vérifiés contre la base réelle (voir historique git). Les mots de passe ci-dessous n'ont pas pu être re-vérifiés (hashés en base) — teste-les avant l'entretien.

---

## Partie 1 — Pour le client existant : les fonctionnalités (12 min)

### 1.1 Connexion admin et dashboard global (2 min)

| Action | Résultat attendu |
|--------|------------------|
| Ouvrir `http://localhost:3000/app` | Page de login SmartPointage |
| Login : `admin.pamecas` / `pamecas2024!` | Dashboard multi-agences PAMECAS |
| Observer les graphiques | Pointages du jour, taux de présence, retard, absentéisme |

**🎯 À montrer :**
- Vue consolidée des 11 agences PAMECAS
- Widgets temps réel : présents, retards, absents
- Navigation multi-tenant (PAMECAS / CMS / GMV)

**💬 À dire client :**
> "SmartPointage vous donne une vue temps réel sur l'ensemble de votre réseau. Taux de présence, retards, absents — tout est consolidé."

---

### 1.2 Liste agents et QR dynamique (2 min)

| Action | Résultat attendu |
|--------|------------------|
| Menu **Agents** | Liste des 82 agents PAMECAS |
| Cliquer sur **SMP-0001 — Mamadou Diallo** | Modal agent avec 3 slides |
| Slide **QR Code** | QR dynamique TOTP avec compte à rebours |
| Slide **Portail** | Infos de connexion portail agent |

**🎯 À montrer :**
- Filtres par agence, statut, type contrat
- QR dynamique qui change toutes les 30s (anti-fraude)
- Activation/désactivation du TOTP

**💬 À dire client :**
> "Chaque agent a un QR code unique qui change toutes les 30 secondes. Impossible de le copier ou de le réutiliser. C'est notre première couche anti-fraude."

---

### 1.3 Portail agent (mobile) (2 min)

| Action | Résultat attendu |
|--------|------------------|
| Ouvrir `http://localhost:3000/agent` sur mobile | Page de login portail agent |
| Login : `SMP-0001` / `0001` | Dashboard agent : badge QR, stats, congés |
| Observer le badge QR | QR dynamique avec timer 30s |
| Onglet **Mes stats** | Pointages des 30 derniers jours |
| Onglet **Mes congés** | Demandes de congés et historique |

**💬 À dire client :**
> "L'agent a son propre espace : il peut voir ses pointages, son QR dynamique, demander des congés. Tout depuis son téléphone, sans installation."

---

### 1.4 Kiosque pointage (3 min)

| Action | Résultat attendu |
|--------|------------------|
| Menu **Sites** → **PAM-STL (Saint-Louis)** | Détail agence |
| Cliquer **Déployer kiosque** | Nouvel onglet kiosque avec caméra |
| Scanner le QR de l'agent (`SMP-0001` sur mobile) | ✅ **Beep arrivée** — "Mamadou Diallo a pointé à 08h02" |
| Scanner le QR à nouveau | ❌ **Cooldown 60s** — message d'attente |
| Attendre 60s et rescanner | ✅ **Beep départ** — "Mamadou Diallo a quitté à 17h32" |

**🎯 À montrer :**
- Scan QR temps réel avec jsQR
- Son d'arrivée/départ
- Cooldown anti-fraude (60s)
- Géofencing (tentative hors zone → refus)

**🔧 Test géofencing (console F12) :**
```javascript
// Simuler GPS hors zone (Paris)
navigator.geolocation.getCurrentPosition = (s) => s({
  coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 10 },
  timestamp: Date.now()
});
// Scanner → "Hors zone — distance: 4542km (max 500m)"
// Recharger la page pour annuler la simulation
location.reload();
```

**💬 À dire client :**
> "Le kiosque tourne sur n'importe quel navigateur, sans installation. Le géofencing bloque les pointages hors zone. Et le cooldown empêche les scans en rafale."

---

### 1.5 Rapports et export Excel (1 min)

| Action | Résultat attendu |
|--------|------------------|
| Menu **Rapports** | Interface de génération de rapports |
| Sélectionner **PAMECAS** et **Ce mois-ci** | Aperçu des statistiques |
| Cliquer **Exporter Excel** | Téléchargement fichier `.xlsx` brandé |

**💬 À dire client :**
> "Rapports mensuels automatisés, export Excel brandé, et envoi par email aux RH. Plus besoin de saisir les pointages à la main."

---

### 1.6 Gestion des congés (1 min)

| Action | Résultat attendu |
|--------|------------------|
| Menu **Congés** | Liste des demandes en cours |
| Filtrer par **En attente** | Voir les demandes non traitées |
| Approuver le congé de **Mamadou Diallo (DG)** | ✅ Statut passe à "Approuvé" |
| Retourner sur le portail agent | Le congé apparaît dans l'historique |

**💬 À dire client :**
> "L'agent soumet sa demande depuis son portail, l'admin approuve en un clic. Plus de papier, plus de suivi par email."

---

### 1.7 Sécurité — session unique (1 min)

| Action | Résultat attendu |
|--------|------------------|
| Connecter `SMP-0001` sur mobile A | ✅ Session active |
| Connecter `SMP-0001` sur mobile B | ✅ Nouvelle session active |
| Retourner sur mobile A | ❌ Déconnecté — "Session expirée" |

**💬 À dire client :**
> "Chaque connexion invalide la précédente. Un agent ne peut pas être connecté sur deux téléphones à la fois. C'est notre deuxième couche anti-fraude."

---

## Partie 2 — Pour le prospect : l'offre et les tarifs (8 min)

### 2.1 Multi-tenant : 3 clients sur une même plateforme (2 min)

| Action | Résultat attendu |
|--------|------------------|
| Naviguer vers **CMS** (Crédit Mutuel Sénégal) | Interface brandée CMS (bleu) |
| Comparer avec **PAMECAS** (vert) | Chaque tenant a son thème, ses données |
| Naviguer vers **GMV** (ASERGMV) | Interface brandée, terminologie adaptée |

**💬 À dire prospect :**
> "SmartPointage est multi-tenant : chaque client a ses données isolées, sa marque, ses utilisateurs. PAMECAS (microfinance), CMS (banque), et ASERGMV (programme environnemental) — trois clients complètement différents sur la même plateforme."

---

### 2.2 Offre et tarifs (2 min)

| Élément | Détail |
|---------|--------|
| **Plan Essentiel** | 2 500 FCFA/agent/mois — structures mono-agence ou terrain |
| **Plan Pro** | 3 500 FCFA/agent/mois — structures multi-agences |
| **Inclus** | QR dynamique TOTP, géofencing, kiosque, portail agent, congés, rapports Excel |
| **Options** | WebAuthn passkey, SMS OTP, email automatique, support prioritaire |
| **Déploiement** | SaaS (hébergé) ou On-Premise (chez le client) |

**💬 À dire prospect :**
> "Tarification à l'agent, pas au forfait : vous ne payez que pour vos agents actifs. 2 500 FCFA par agent et par mois en Essentiel, 3 500 FCFA en Pro pour les structures multi-agences."

---

### 2.3 Sécurité — les 7 couches anti-fraude (2 min)

| Couche | Technologie | Impact |
|--------|------------|--------|
| 1. **QR dynamique TOTP** | HMAC-SHA256, change toutes les 30s | ✅ Copie impossible |
| 2. **Géofencing GPS** | Rayon 500m (Haversine) | ✅ Pointage hors zone bloqué |
| 3. **Session unique** | `session_token` en base | ✅ Pas de double connexion |
| 4. **Cooldown** | 60s entre deux scans | ✅ Pas de rafale |
| 5. **PIN kiosque rotatif** | Change toutes les 8h | ✅ Admin only |
| 6. **Multi-tenant** | `instance_slug` sur chaque document | ✅ Isolation totale |
| 7. **WebAuthn Passkey** | Biométrie appareil | ✅ Connexion admin sans mot de passe |

**💬 À dire prospect :**
> "Sept couches de sécurité. Pas de badge qu'on peut prêter, pas de scan à distance, pas de double connexion. SmartPointage est le seul système de pointage au Sénégal avec TOTP dynamique."

---

### 2.4 Offline-first (1 min)

| Action | Résultat attendu |
|--------|------------------|
| Couper le WiFi | Le kiosque continue de fonctionner |
| Scanner un QR | ✅ Pointage enregistré localement (IndexedDB) |
| Rétablir le WiFi | ✅ Synchronisation automatique |
| Vérifier le dashboard | ✅ Pointage apparu dans les stats |

**💬 À dire prospect :**
> "Le kiosque marche même sans Internet. Les pointages sont stockés dans le navigateur et synchronisés automatiquement quand la connexion revient. Parfait pour les zones rurales."

---

### 2.5 Déploiement rapide (1 min)

| Étape | Délai |
|-------|-------|
| Création du tenant | 10 min |
| Import des agences et agents | 30 min (CSV) |
| Déploiement kiosque (1ère agence) | 15 min |
| Formation des agents | 1h |
| **Mise en production** | **< 1 jour** |

---

## Résumé des comptes de démonstration

### Client existant (PAMECAS)

| Compte | Login | Mot de passe | Rôle |
|--------|-------|-------------|------|
| Superadmin | `admin.pamecas` | `pamecas2024!` | Tous sites |
| Admin DG | `admin.dg` | `pamecas2024!` | Direction Générale |
| Directeur régional | `directeur.dakar` | *(à vérifier)* | Région Dakar |
| Agent | `SMP-0001` | `0001` | Mamadou Diallo (DG) |

### Prospect — voir les 3 tenants (CMS, GMV)

| Compte | Login | Mot de passe | Rôle |
|--------|-------|-------------|------|
| Superadmin CMS | `admin.cms` | `cms2024!` | Crédit Mutuel Sénégal |
| Superadmin GMV | `directeur.gmv` | `gmv2024!` | ASERGMV |

---

## Checklist de préparation

- [ ] `npm run seed && npm run seed:cms && npm run seed:gmv && npm run seed:demo`
- [ ] Démarrer le serveur : `npm run dev`
- [ ] Ouvrir le dashboard admin : `http://localhost:3000/app`
- [ ] Ouvrir le portail agent sur mobile : `http://localhost:3000/agent`
- [ ] Ouvrir le kiosque : `http://localhost:3000/app/#/kiosque` (et non `/kiosk` — route corrigee)
- [ ] Vérifier que les 3 tenants sont accessibles
- [ ] Vérifier les pointages des 30 derniers jours
- [ ] Vérifier les congés en attente
- [ ] Préparer la console F12 pour les simulations GPS

---

*Document généré le 3 septembre 2026 — SmartPointage Demo v2*