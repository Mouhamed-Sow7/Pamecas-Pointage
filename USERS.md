# SmartPointage — Référence des comptes utilisateurs

> **Usage interne uniquement.** Ne jamais partager ce fichier publiquement.  
> Mis à jour : juillet 2026  
> Pour réinitialiser tous les mots de passe aux valeurs ci-dessous : `node server/scripts/reset-demo-passwords.js`

---

## Comment se connecter

La page de login détecte automatiquement le tenant via l'URL ou le slug.  
Le login est **uniquement basé sur le `username`** — pas d'email, pas de sélection de tenant.  
Les usernames sont **uniques globalement** (ex: `admin.dg@cms` pour CMS, `admin.dg` pour PAMECAS).

---

## 🔑 Super Admin Global (God Mode)

Accès depuis la console développeur uniquement (route secrète `/api/auth/godmode`).

| Variable env | Description |
|---|---|
| `GOD_MODE_PASSWORD` | Défini dans `.env` — consulter le fichier `.env` du serveur |

---

## 🏦 Tenant 1 — PAMECAS (`instance_slug: pamecas`)

Microfinance, réseau d'agences Dakar + Saint-Louis.

### Superadmin / Direction

| Username | Mot de passe | Rôle | Périmètre |
|---|---|---|---|
| `admin` | `pamecas2024!` | superadmin | Tout le réseau PAMECAS |
| `directeur.dakar` | `pamecas2024!` | directeur_regional | Toutes agences Dakar |

### Admins d'agence

| Username | Mot de passe | Rôle | Agence |
|---|---|---|---|
| `admin.dg` | `pamecas2024!` | admin | Direction Générale (PAM-DG) |
| `admin.bene` | `pamecas2024!` | admin | Agence Bene Tally (PAM-BENE) |
| `admin.bourg` | `pamecas2024!` | admin | Agence Bourguiba (PAM-BOURG) |
| `admin.cast` | `pamecas2024!` | admin | Agence Castors (PAM-CAST) |
| `admin.avion` | `pamecas2024!` | admin | Agence Cité Avion (PAM-AVION) |
| `admin.gyoff` | `pamecas2024!` | admin | Agence Grand Yoff (PAM-GYOFF) |
| `admin.hlm` | `pamecas2024!` | admin | Agence HLM (PAM-HLM) |
| `admin.ouak` | `pamecas2024!` | admin | Agence Ouakam (PAM-OUAK) |
| `admin.vdn` | `pamecas2024!` | admin | Agence VDN (PAM-VDN) |
| `admin.yoff` | `pamecas2024!` | admin | Agence Yoff (PAM-YOFF) |
| `admin.stl` | `pamecas2024!` | admin | Agence Saint-Louis (PAM-STL) |

### Pointeurs

| Username | Mot de passe | Rôle | Agence |
|---|---|---|---|
| `point.dg` | `point2024!` | pointeur | Direction Générale (PAM-DG) |
| `point.bene` | `point2024!` | pointeur | Agence Bene Tally (PAM-BENE) |
| `point.stl` | `point2024!` | pointeur | Saint-Louis (PAM-STL) |

---

## 🏦 Tenant 2 — Crédit Mutuel Sénégal (`instance_slug: cms`)

Réseau bancaire, agences Dakar + Thiès.

> **Note :** Les usernames CMS se terminent par `@cms` pour éviter les collisions avec PAMECAS.

### Superadmin / Direction

| Username | Mot de passe | Rôle | Périmètre |
|---|---|---|---|
| `admin.cms` | `cms2024!` | superadmin | Tout le réseau CMS |
| `directeur.cms` | `cms2024!` | directeur_regional | Toutes agences CMS |

### Admins d'agence

| Username | Mot de passe | Rôle | Agence |
|---|---|---|---|
| `admin.dg@cms` | `cms2024!` | admin | Direction Générale CMS |
| `admin.gyoff@cms` | `cms2024!` | admin | Agence Grand Yoff |
| `admin.pikine@cms` | `cms2024!` | admin | Agence Pikine |
| `admin.guediawaye@cms` | `cms2024!` | admin | Agence Guédiawaye |
| `admin.thies@cms` | `cms2024!` | admin | Agence Thiès |

### Pointeurs

| Username | Mot de passe | Rôle | Agence |
|---|---|---|---|
| `point.dg@cms` | `point2024!` | pointeur | Direction Générale CMS |

---

## 🌿 Tenant 3 — ASERGMV / Grande Muraille Verte (`instance_slug: gmv`)

Programme Xëyu Ndaw Ñi, zones agricoles Saint-Louis / Louga / Tambacounda.

> **Note :** Terminologie spécifique GMV : Agence → Zone, Agent → Jeune Xëyu Ndaw Ñi, Pointeur → Chef de secteur, Directeur Rég. → Inspecteur régional

### Direction

| Username | Mot de passe | Rôle | Périmètre |
|---|---|---|---|
| `directeur.gmv` | `gmv2024!` | superadmin | Direction nationale ASERGMV |

### Inspecteurs régionaux

| Username | Mot de passe | Rôle | Zones |
|---|---|---|---|
| `inspecteur.sl` | `gmv2024!` | directeur_regional | Rao, Bango, Podor |
| `inspecteur.lg` | `gmv2024!` | directeur_regional | Widou, Lompoul |
| `inspecteur.tb` | `gmv2024!` | directeur_regional | Bakel, Goudiry |

### Chefs de zone (admin)

| Username | Mot de passe | Zone |
|---|---|---|
| `chef.rao` | `gmv2024!` | Zone Rao (GMV-SL-RAO) |
| `chef.bango` | `gmv2024!` | Zone Bango (GMV-SL-BANGO) |
| `chef.podor` | `gmv2024!` | Pépinière Podor (GMV-SL-PODOR) |
| `chef.widou` | `gmv2024!` | Zone Widou (GMV-LG-WIDOU) |
| `chef.lompoul` | `gmv2024!` | Zone Lompoul (GMV-LG-LOMPOUL) |
| `chef.bakel` | `gmv2024!` | Zone Bakel (GMV-TB-BAKEL) |
| `chef.goudiry` | `gmv2024!` | Zone Goudiry (GMV-TB-GOUDIRY) |

### Pointeurs

| Username | Mot de passe | Zone |
|---|---|---|
| `pointeur.rao` | `gmv2024!` | Zone Rao |
| `pointeur.bango` | `gmv2024!` | Zone Bango |
| `pointeur.widou` | `gmv2024!` | Zone Widou |
| `pointeur.bakel` | `gmv2024!` | Zone Bakel |

---

## Rôles et permissions

| Rôle | Accès |
|---|---|
| `superadmin` | Tout le tenant — tous sites, tous agents, tous rapports |
| `directeur_regional` | Plusieurs sites assignés (`sites_ids`) |
| `admin` | Un seul site (`site_id`) — gestion agents, pointages, congés |
| `superviseur` | Un site — lecture des pointages |
| `pointeur` | Un site — saisie des pointages uniquement |

---

## Portail Agent (séparé du portail RH)

Les agents pointeurs accèdent via `/agent` avec leur **matricule** et un mot de passe agent distinct (pas le même système que les Users ci-dessus).  
Mot de passe par défaut des agents seed : basé sur le matricule — voir `server/seed.js` ligne ~991.

---

## ⚠️ Avertissements

- Ces credentials sont ceux du **seed de développement/démo**. En production, les mots de passe doivent être changés.
- Si un mot de passe a été changé manuellement en base, le reset script permet de revenir aux valeurs ci-dessus.
- Ne jamais committer le fichier `.env` contenant `GOD_MODE_PASSWORD` et `JWT_SECRET`.
