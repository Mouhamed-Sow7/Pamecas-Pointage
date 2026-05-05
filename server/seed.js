const dotenv = require("dotenv");
dotenv.config();
const { v4: uuidv4 } = require("uuid");
const { connectDB, mongoose } = require("./config/db");
const Site = require("./models/Site");
const User = require("./models/User");
const Agent = require("./models/Agent");
const Pointage = require("./models/Pointage");

// ─── Donnees de reference ────────────────────────────────────────
const agences = [
  {
    code: "PAM-DG",
    nom: "Direction Generale",
    region: "Dakar",
    telephone: "77 388 62 07",
    adresse: "Sicap Baobab, Avenue Bourguiba",
    config: {
      heure_debut: "08:00",
      heure_retard: "08:15",
      weekend_actif: false,
    },
  },
  {
    code: "PAM-BENE",
    nom: "Agence Bene Tally",
    region: "Dakar",
    telephone: "77 827 34 91",
    adresse: "Usine Bene Tally apres la pharmacie",
    config: {
      heure_debut: "08:00",
      heure_retard: "08:15",
      weekend_actif: false,
    },
  },
  {
    code: "PAM-BOURG",
    nom: "Agence Bourguiba",
    region: "Dakar",
    telephone: "77 388 62 07",
    adresse: "Sicap Baobab, Avenue Bourguiba",
    config: {
      heure_debut: "08:00",
      heure_retard: "08:15",
      weekend_actif: false,
    },
  },
  {
    code: "PAM-CAST",
    nom: "Agence Castors",
    region: "Dakar",
    telephone: "77 463 02 20",
    adresse: "Marche Castors angle supermarche AUCHAN",
    config: {
      heure_debut: "08:00",
      heure_retard: "08:15",
      weekend_actif: false,
    },
  },
  {
    code: "PAM-AVION",
    nom: "Agence Cite Avion",
    region: "Dakar",
    telephone: "77 529 67 61",
    adresse: "Citee Avion",
    config: {
      heure_debut: "08:00",
      heure_retard: "08:15",
      weekend_actif: false,
    },
  },
  {
    code: "PAM-GYOFF",
    nom: "Agence Grand Yoff",
    region: "Dakar",
    telephone: "77 265 38 12",
    adresse: "Grand Yoff, Arafat, pres de la police",
    config: {
      heure_debut: "08:00",
      heure_retard: "08:15",
      weekend_actif: false,
    },
  },
  {
    code: "PAM-HLM",
    nom: "Agence HLM",
    region: "Dakar",
    telephone: "77 367 51 89",
    adresse: "Marche HLM 5, cote pharmacie Leopold Sedar Senghor",
    config: {
      heure_debut: "08:00",
      heure_retard: "08:15",
      weekend_actif: false,
    },
  },
  {
    code: "PAM-OUAK",
    nom: "Agence Ouakam",
    region: "Dakar",
    telephone: "77 638 34 14",
    adresse: "Ouakam",
    config: {
      heure_debut: "08:00",
      heure_retard: "08:15",
      weekend_actif: false,
    },
  },
  {
    code: "PAM-VDN",
    nom: "Agence VDN",
    region: "Dakar",
    telephone: "77 332 49 46",
    adresse: "VDN, Dakar",
    config: {
      heure_debut: "08:00",
      heure_retard: "08:15",
      weekend_actif: false,
    },
  },
  {
    code: "PAM-YOFF",
    nom: "Agence Yoff",
    region: "Dakar",
    telephone: "77 819 57 79",
    adresse: "Yoff",
    config: {
      heure_debut: "08:00",
      heure_retard: "08:15",
      weekend_actif: false,
    },
  },
];

const agentsParAgence = {
  "PAM-DG": [
    {
      nom: "Diallo",
      prenom: "Mamadou",
      type_contrat: "CDI",
      poste: "Directeur General",
    },
    { nom: "Ndiaye", prenom: "Ibrahima", type_contrat: "CDI", poste: "DRH" },
    {
      nom: "Ba",
      prenom: "Fatou",
      type_contrat: "CDI",
      poste: "Directeur Financier",
    },
    { nom: "Sow", prenom: "Ousmane", type_contrat: "CDI", poste: "DAF" },
    {
      nom: "Fall",
      prenom: "Cheikh",
      type_contrat: "CDI",
      poste: "Directeur Informatique",
    },
    {
      nom: "Gueye",
      prenom: "Aissatou",
      type_contrat: "CDI",
      poste: "Charge Communication",
    },
    {
      nom: "Mbaye",
      prenom: "Mariama",
      type_contrat: "CDD",
      poste: "Assistante DG",
    },
    {
      nom: "Sarr",
      prenom: "Amadou",
      type_contrat: "CDI",
      poste: "Comptable Principal",
    },
    { nom: "Diouf", prenom: "Rokhaya", type_contrat: "CDI", poste: "Juriste" },
    {
      nom: "Faye",
      prenom: "Ndeve",
      type_contrat: "CDD",
      poste: "Standardiste",
    },
  ],
  "PAM-BENE": [
    {
      nom: "Toure",
      prenom: "Modou",
      type_contrat: "CDI",
      poste: "Directeur Agence",
    },
    {
      nom: "Diop",
      prenom: "Abdoulaye",
      type_contrat: "CDI",
      poste: "Responsable Credit",
    },
    {
      nom: "Kane",
      prenom: "Adja",
      type_contrat: "CDI",
      poste: "Caissier Principal",
    },
    {
      nom: "Sy",
      prenom: "Khady",
      type_contrat: "CDD",
      poste: "Conseiller Clientele",
    },
    {
      nom: "Cisse",
      prenom: "Moussa",
      type_contrat: "CDD",
      poste: "Agent de Credit",
    },
    {
      nom: "Thiam",
      prenom: "Aminata",
      type_contrat: "CDD",
      poste: "Charge Recouvrement",
    },
    {
      nom: "Ndoye",
      prenom: "Alioune",
      type_contrat: "CDD",
      poste: "Agent Guichet",
    },
    {
      nom: "Camara",
      prenom: "Coumba",
      type_contrat: "CDD",
      poste: "Secretaire",
    },
  ],
  "PAM-BOURG": [
    {
      nom: "Traore",
      prenom: "Serigne",
      type_contrat: "CDI",
      poste: "Directeur Agence",
    },
    {
      nom: "Kouyate",
      prenom: "Babacar",
      type_contrat: "CDI",
      poste: "Responsable Credit",
    },
    { nom: "Badji", prenom: "Sokhna", type_contrat: "CDD", poste: "Caissier" },
    {
      nom: "Mendy",
      prenom: "Mame",
      type_contrat: "CDD",
      poste: "Conseiller Clientele",
    },
    {
      nom: "Manga",
      prenom: "Pape",
      type_contrat: "CDD",
      poste: "Agent de Credit",
    },
    {
      nom: "Bassene",
      prenom: "Astou",
      type_contrat: "CDD",
      poste: "Charge Recouvrement",
    },
    {
      nom: "Sambou",
      prenom: "Landing",
      type_contrat: "CDD",
      poste: "Agent Guichet",
    },
    {
      nom: "Diatta",
      prenom: "Lamine",
      type_contrat: "CDD",
      poste: "Agent Securite",
    },
  ],
  "PAM-CAST": [
    {
      nom: "Tendeng",
      prenom: "Malick",
      type_contrat: "CDI",
      poste: "Directeur Agence",
    },
    {
      nom: "Goudiaby",
      prenom: "Mamadou",
      type_contrat: "CDI",
      poste: "Responsable Credit",
    },
    {
      nom: "Diallo",
      prenom: "Yacine",
      type_contrat: "CDI",
      poste: "Caissier Principal",
    },
    {
      nom: "Ndiaye",
      prenom: "Binta",
      type_contrat: "CDD",
      poste: "Conseiller Clientele",
    },
    {
      nom: "Ba",
      prenom: "Ibrahima",
      type_contrat: "CDD",
      poste: "Agent de Credit",
    },
    {
      nom: "Sow",
      prenom: "Ndeye",
      type_contrat: "CDD",
      poste: "Gestionnaire Compte",
    },
    {
      nom: "Fall",
      prenom: "Ousmane",
      type_contrat: "CDD",
      poste: "Agent Guichet",
    },
    {
      nom: "Gueye",
      prenom: "Cheikh",
      type_contrat: "stage",
      poste: "Stagiaire",
    },
  ],
  "PAM-AVION": [
    {
      nom: "Mbaye",
      prenom: "Amadou",
      type_contrat: "CDI",
      poste: "Directeur Agence",
    },
    {
      nom: "Sarr",
      prenom: "Modou",
      type_contrat: "CDI",
      poste: "Responsable Credit",
    },
    { nom: "Diouf", prenom: "Fatou", type_contrat: "CDD", poste: "Caissier" },
    {
      nom: "Faye",
      prenom: "Aissatou",
      type_contrat: "CDD",
      poste: "Conseiller Clientele",
    },
    {
      nom: "Toure",
      prenom: "Abdoulaye",
      type_contrat: "CDD",
      poste: "Agent de Credit",
    },
    {
      nom: "Diop",
      prenom: "Mariama",
      type_contrat: "CDD",
      poste: "Charge Recouvrement",
    },
    {
      nom: "Kane",
      prenom: "Moussa",
      type_contrat: "CDD",
      poste: "Agent Guichet",
    },
    { nom: "Sy", prenom: "Rokhaya", type_contrat: "CDD", poste: "Secretaire" },
  ],
  "PAM-GYOFF": [
    {
      nom: "Cisse",
      prenom: "Alioune",
      type_contrat: "CDI",
      poste: "Directeur Agence",
    },
    {
      nom: "Thiam",
      prenom: "Serigne",
      type_contrat: "CDI",
      poste: "Responsable Credit",
    },
    {
      nom: "Ndoye",
      prenom: "Ndeve",
      type_contrat: "CDI",
      poste: "Caissier Principal",
    },
    {
      nom: "Camara",
      prenom: "Adja",
      type_contrat: "CDD",
      poste: "Conseiller Clientele",
    },
    {
      nom: "Traore",
      prenom: "Babacar",
      type_contrat: "CDD",
      poste: "Agent de Credit",
    },
    {
      nom: "Kouyate",
      prenom: "Khady",
      type_contrat: "CDD",
      poste: "Charge Recouvrement",
    },
    {
      nom: "Badji",
      prenom: "Pape",
      type_contrat: "CDD",
      poste: "Agent Guichet",
    },
    {
      nom: "Mendy",
      prenom: "Landing",
      type_contrat: "CDD",
      poste: "Agent Securite",
    },
  ],
  "PAM-HLM": [
    {
      nom: "Manga",
      prenom: "Lamine",
      type_contrat: "CDI",
      poste: "Directeur Agence",
    },
    {
      nom: "Bassene",
      prenom: "Malick",
      type_contrat: "CDI",
      poste: "Responsable Credit",
    },
    {
      nom: "Sambou",
      prenom: "Aminata",
      type_contrat: "CDD",
      poste: "Caissier",
    },
    {
      nom: "Diatta",
      prenom: "Coumba",
      type_contrat: "CDD",
      poste: "Conseiller Clientele",
    },
    {
      nom: "Tendeng",
      prenom: "Mamadou",
      type_contrat: "CDD",
      poste: "Agent de Credit",
    },
    {
      nom: "Goudiaby",
      prenom: "Sokhna",
      type_contrat: "CDD",
      poste: "Gestionnaire Compte",
    },
    {
      nom: "Diallo",
      prenom: "Ibrahima",
      type_contrat: "CDD",
      poste: "Charge Informatique",
    },
    { nom: "Ndiaye", prenom: "Mame", type_contrat: "CDD", poste: "Secretaire" },
  ],
  "PAM-OUAK": [
    {
      nom: "Ba",
      prenom: "Ousmane",
      type_contrat: "CDI",
      poste: "Directeur Agence",
    },
    {
      nom: "Sow",
      prenom: "Cheikh",
      type_contrat: "CDI",
      poste: "Responsable Credit",
    },
    {
      nom: "Fall",
      prenom: "Astou",
      type_contrat: "CDI",
      poste: "Caissier Principal",
    },
    {
      nom: "Gueye",
      prenom: "Yacine",
      type_contrat: "CDD",
      poste: "Conseiller Clientele",
    },
    {
      nom: "Mbaye",
      prenom: "Amadou",
      type_contrat: "CDD",
      poste: "Agent de Credit",
    },
    {
      nom: "Sarr",
      prenom: "Binta",
      type_contrat: "CDD",
      poste: "Charge Recouvrement",
    },
    {
      nom: "Diouf",
      prenom: "Modou",
      type_contrat: "CDD",
      poste: "Agent Guichet",
    },
    {
      nom: "Faye",
      prenom: "Ndeye",
      type_contrat: "stage",
      poste: "Stagiaire Finance",
    },
  ],
  "PAM-VDN": [
    {
      nom: "Toure",
      prenom: "Abdoulaye",
      type_contrat: "CDI",
      poste: "Directeur Agence",
    },
    {
      nom: "Diop",
      prenom: "Moussa",
      type_contrat: "CDI",
      poste: "Responsable Credit",
    },
    { nom: "Kane", prenom: "Fatou", type_contrat: "CDD", poste: "Caissier" },
    {
      nom: "Sy",
      prenom: "Aissatou",
      type_contrat: "CDD",
      poste: "Conseiller Clientele",
    },
    {
      nom: "Cisse",
      prenom: "Alioune",
      type_contrat: "CDD",
      poste: "Agent de Credit",
    },
    {
      nom: "Thiam",
      prenom: "Mariama",
      type_contrat: "CDD",
      poste: "Charge Recouvrement",
    },
    {
      nom: "Ndoye",
      prenom: "Serigne",
      type_contrat: "CDD",
      poste: "Gestionnaire Compte",
    },
    {
      nom: "Camara",
      prenom: "Rokhaya",
      type_contrat: "CDD",
      poste: "Secretaire",
    },
  ],
  "PAM-YOFF": [
    {
      nom: "Traore",
      prenom: "Babacar",
      type_contrat: "CDI",
      poste: "Directeur Agence",
    },
    {
      nom: "Kouyate",
      prenom: "Pape",
      type_contrat: "CDI",
      poste: "Responsable Credit",
    },
    {
      nom: "Badji",
      prenom: "Ndeve",
      type_contrat: "CDI",
      poste: "Caissier Principal",
    },
    {
      nom: "Mendy",
      prenom: "Adja",
      type_contrat: "CDD",
      poste: "Conseiller Clientele",
    },
    {
      nom: "Manga",
      prenom: "Landing",
      type_contrat: "CDD",
      poste: "Agent de Credit",
    },
    {
      nom: "Bassene",
      prenom: "Khady",
      type_contrat: "CDD",
      poste: "Charge Recouvrement",
    },
    {
      nom: "Sambou",
      prenom: "Lamine",
      type_contrat: "CDD",
      poste: "Agent Guichet",
    },
    {
      nom: "Diatta",
      prenom: "Malick",
      type_contrat: "CDD",
      poste: "Agent Securite",
    },
  ],
};

// Users par agence (admin local)
const usersAgences = [
  {
    username: "admin.dg",
    password: "pamecas2024!",
    role: "admin",
    nom_complet: "Admin Direction Generale",
    agenceCode: "PAM-DG",
  },
  {
    username: "admin.bene",
    password: "pamecas2024!",
    role: "admin",
    nom_complet: "Admin Agence Bene Tally",
    agenceCode: "PAM-BENE",
  },
  {
    username: "admin.cast",
    password: "pamecas2024!",
    role: "admin",
    nom_complet: "Admin Agence Castors",
    agenceCode: "PAM-CAST",
  },
  {
    username: "admin.gyoff",
    password: "pamecas2024!",
    role: "admin",
    nom_complet: "Admin Agence Grand Yoff",
    agenceCode: "PAM-GYOFF",
  },
  {
    username: "admin.bourg",
    password: "pamecas2024!",
    role: "admin",
    nom_complet: "Admin Agence Bourguiba",
    agenceCode: "PAM-BOURG",
  },
  {
    username: "admin.avion",
    password: "pamecas2024!",
    role: "admin",
    nom_complet: "Admin Agence Cite Avion",
    agenceCode: "PAM-AVION",
  },
  {
    username: "admin.hlm",
    password: "pamecas2024!",
    role: "admin",
    nom_complet: "Admin Agence HLM",
    agenceCode: "PAM-HLM",
  },
  {
    username: "admin.ouak",
    password: "pamecas2024!",
    role: "admin",
    nom_complet: "Admin Agence Ouakam",
    agenceCode: "PAM-OUAK",
  },
  {
    username: "admin.vdn",
    password: "pamecas2024!",
    role: "admin",
    nom_complet: "Admin Agence VDN",
    agenceCode: "PAM-VDN",
  },
  {
    username: "admin.yoff",
    password: "pamecas2024!",
    role: "admin",
    nom_complet: "Admin Agence Yoff",
    agenceCode: "PAM-YOFF",
  },
  {
    username: "point.dg",
    password: "point2024!",
    role: "pointeur",
    nom_complet: "Pointeur Direction Gen.",
    agenceCode: "PAM-DG",
  },
  {
    username: "point.bene",
    password: "point2024!",
    role: "pointeur",
    nom_complet: "Pointeur Bene Tally",
    agenceCode: "PAM-BENE",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────
function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function heure(h, m) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Genere un statut realiste avec probabilites
function genererStatut(heureArrivee) {
  const [h, m] = heureArrivee.split(":").map(Number);
  const minutes = h * 60 + m;
  if (minutes <= 8 * 60 + 10) return "present";
  if (minutes <= 8 * 60 + 30) return "retard";
  return "absent";
}

async function genererPointagesSemaine(agents, siteId, superviseurId) {
  const pointages = [];
  // 7 derniers jours (lundi-vendredi seulement)
  for (let offset = -7; offset <= -1; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const jourSemaine = d.getDay(); // 0=dim, 6=sam
    if (jourSemaine === 0 || jourSemaine === 6) continue; // skip weekend

    const dateString = d.toISOString().slice(0, 10);

    for (const agent of agents) {
      // 85% de chance de presence, 10% absence, 5% retard extreme
      const roll = Math.random();
      let heureArrivee, heureDepart, statut;

      if (roll < 0.75) {
        // Present a l'heure
        heureArrivee = heure(7, rand(55, 60) % 60 === 0 ? 8 : rand(55, 59));
        heureArrivee = heure(7, rand(50, 59));
        if (
          parseInt(heureArrivee.split(":")[0]) === 7 &&
          parseInt(heureArrivee.split(":")[1]) >= 50
        ) {
          heureArrivee = heure(8, rand(0, 10));
        }
        statut = "present";
        heureDepart = heure(17, rand(0, 30));
      } else if (roll < 0.88) {
        // Retard leger
        heureArrivee = heure(8, rand(16, 45));
        statut = "retard";
        heureDepart = heure(17, rand(0, 30));
      } else if (roll < 0.95) {
        // Absent
        statut = "absent";
        heureArrivee = null;
        heureDepart = null;
      } else {
        // Present mais parti tot
        heureArrivee = heure(8, rand(0, 10));
        statut = "present";
        heureDepart = heure(15, rand(0, 30));
      }

      let duree = null;
      if (heureArrivee && heureDepart) {
        const [h1, m1] = heureArrivee.split(":").map(Number);
        const [h2, m2] = heureDepart.split(":").map(Number);
        duree = h2 * 60 + m2 - (h1 * 60 + m1);
      }

      try {
        await Pointage.findOneAndUpdate(
          { agent_id: agent._id, site_id: siteId, date: dateString },
          {
            agent_id: agent._id,
            site_id: siteId,
            date: dateString,
            heure_arrivee: heureArrivee,
            heure_depart: heureDepart,
            duree_minutes: duree,
            statut,
            methode: Math.random() > 0.4 ? "qr_code" : "manuel",
            superviseur_id: superviseurId,
            note:
              statut === "absent" && Math.random() > 0.5
                ? "Absence justifiee"
                : "",
            sync_status: "synced",
            synced_at: new Date(),
          },
          { upsert: true, new: true },
        );
        pointages.push(`${dateString} - ${agent.nom} ${statut}`);
      } catch (e) {
        // Ignore duplicates
      }
    }
  }
  return pointages;
}

// ─── Seed principal ──────────────────────────────────────────────
async function seed() {
  try {
    await connectDB();
    await new Promise((resolve, reject) => {
      const conn = mongoose.connection;
      if (conn.readyState === 1) return resolve();
      conn.once("connected", resolve);
      conn.once("error", reject);
    });

    console.log("Connexion DB etablie...");

    // 1. Agences
    const sitesMap = {};
    for (const agence of agences) {
      // Préserver le kiosque_token existant — ne pas l'écraser au reseed
      const existing = await Site.findOne({ code: agence.code });
      const updateData = { ...agence, actif: true };
      if (existing?.kiosque_token) {
        delete updateData.kiosque_token;
        delete updateData.kiosque_token_created_at;
      } else {
        updateData.kiosque_token = uuidv4();
        updateData.kiosque_token_created_at = new Date();
      }
      const site = await Site.findOneAndUpdate(
        { code: agence.code },
        updateData,
        { upsert: true, new: true },
      );
      sitesMap[agence.code] = site;
    }
    await Site.deleteOne({ code: "GDS-PRINCIPAL" });
    console.log(`${agences.length} agences initialisees`);

    // 2. Superadmin
    const superadminData = {
      username: "admin",
      password: "pamecas2024!",
      role: "superadmin",
      nom_complet: "Super Administrateur SmartPointage",
      actif: true,
    };
    let superadmin = await User.findOne({ username: "admin" });
    if (!superadmin) {
      superadmin = new User(superadminData);
      await superadmin.save();
      console.log("Superadmin cree");
    }

    // 2b. Directeur régional Dakar
    let directeur = await User.findOne({ username: "directeur.dakar" });
    if (!directeur) {
      const sitesDakar = ["PAM-DG", "PAM-BENE", "PAM-CAST"]
        .map((code) => sitesMap[code]?._id)
        .filter(Boolean);
      directeur = new User({
        username: "directeur.dakar",
        password: "pamecas2024!",
        role: "directeur_regional",
        nom_complet: "Directeur Régional Dakar",
        sites_ids: sitesDakar,
        actif: true,
      });
      await directeur.save();
      console.log("Directeur régional Dakar créé (PAM-DG, PAM-BENE, PAM-CAST)");
    }

    // 3. Users par agence
    for (const ud of usersAgences) {
      const site = sitesMap[ud.agenceCode];
      if (!site) continue;
      const existing = await User.findOne({ username: ud.username });
      if (!existing) {
        const u = new User({
          username: ud.username,
          password: ud.password,
          role: ud.role,
          nom_complet: ud.nom_complet,
          site_id: site._id,
          actif: true,
        });
        await u.save();
        console.log(
          `User cree: ${ud.username} (${ud.role} - ${ud.agenceCode})`,
        );
      }
    }

    // 4. Agents + pointages de demo
    let totalAgents = 0;
    let totalPointages = 0;

    for (const [agenceCode, agentsData] of Object.entries(agentsParAgence)) {
      const site = sitesMap[agenceCode];
      if (!site) continue;

      const agentsInseres = [];
      for (const ad of agentsData) {
        const existing = await Agent.findOne({
          nom: ad.nom,
          prenom: ad.prenom,
          site_id: site._id,
        });
        if (!existing) {
          const agent = new Agent({
            nom: ad.nom,
            prenom: ad.prenom,
            type_contrat: ad.type_contrat,
            poste: ad.poste,
            site_id: site._id,
            actif: true,
          });
          await agent.save();
          agentsInseres.push(agent);
          totalAgents++;
        } else {
          agentsInseres.push(existing);
        }
      }

      // Pointages sur 7 jours
      const pointages = await genererPointagesSemaine(
        agentsInseres,
        site._id,
        superadmin._id,
      );
      totalPointages += pointages.length;
      console.log(
        `${agenceCode}: ${agentsInseres.length} agents, ${pointages.length} pointages`,
      );

      // Activer comptes portail (mot de passe = derniers 4 chiffres matricule)
      const bcrypt = require("bcryptjs");
      for (const agent of agentsInseres) {
        let changed = false;
        if (!agent.password_hash) {
          const defaultPwd = agent.matricule.slice(-4);
          agent.password_hash = await bcrypt.hash(defaultPwd, 10);
          changed = true;
        }
        if (!agent.totp_enabled || !agent.totp_secret) {
          agent.genererTOTPSecret(); // génère secret + totp_enabled = true
          changed = true;
        }
        if (changed) await agent.save();
      }
    }

    console.log("");
    console.log("=== SEED TERMINE ===");
    console.log(`Agences     : ${agences.length}`);
    console.log(`Agents      : ${totalAgents} nouveaux`);
    console.log(`Pointages   : ${totalPointages} sur 7 jours`);
    console.log("");
    console.log("=== COMPTES DE CONNEXION ===");
    console.log("Superadmin  : admin / pamecas2024!");
    console.log("Dir. Dakar  : directeur.dakar / pamecas2024!");
    console.log("Admin DG    : admin.dg / pamecas2024!");
    console.log("Admin Bene  : admin.bene / pamecas2024!");
    console.log("Pointeur DG : point.dg / point2024!");
    console.log("");
  } catch (err) {
    console.error("Erreur seed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
