const dotenv = require('dotenv');
dotenv.config();
const { connectDB, mongoose } = require('./config/db');
const Site = require('./models/Site');
const User = require('./models/User');
const Agent = require('./models/Agent');
const Pointage = require('./models/Pointage');

// ─── Donnees de reference ────────────────────────────────────────
const agences = [
  { code: 'PAM-DG',    nom: 'Direction Generale',  region: 'Dakar', telephone: '77 388 62 07', adresse: 'Sicap Baobab, Avenue Bourguiba', config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false } },
  { code: 'PAM-BENE',  nom: 'Agence Bene Tally',   region: 'Dakar', telephone: '77 827 34 91', adresse: 'Usine Bene Tally apres la pharmacie', config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false } },
  { code: 'PAM-BOURG', nom: 'Agence Bourguiba',    region: 'Dakar', telephone: '77 388 62 07', adresse: 'Sicap Baobab, Avenue Bourguiba', config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false } },
  { code: 'PAM-CAST',  nom: 'Agence Castors',      region: 'Dakar', telephone: '77 463 02 20', adresse: 'Marche Castors angle supermarche AUCHAN', config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false } },
  { code: 'PAM-AVION', nom: 'Agence Cite Avion',   region: 'Dakar', telephone: '77 529 67 61', adresse: 'Citee Avion', config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false } },
  { code: 'PAM-GYOFF', nom: 'Agence Grand Yoff',   region: 'Dakar', telephone: '77 265 38 12', adresse: 'Grand Yoff, Arafat, pres de la police', config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false } },
  { code: 'PAM-HLM',   nom: 'Agence HLM',          region: 'Dakar', telephone: '77 367 51 89', adresse: 'Marche HLM 5, cote pharmacie Leopold Sedar Senghor', config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false } },
  { code: 'PAM-OUAK',  nom: 'Agence Ouakam',       region: 'Dakar', telephone: '77 638 34 14', adresse: 'Ouakam', config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false } },
  { code: 'PAM-VDN',   nom: 'Agence VDN',          region: 'Dakar', telephone: '77 332 49 46', adresse: 'VDN, Dakar', config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false } },
  { code: 'PAM-YOFF',  nom: 'Agence Yoff',         region: 'Dakar', telephone: '77 819 57 79', adresse: 'Yoff', config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false } },
];

// Agents fictifs par agence (noms senegalais realistes)
const agentsParAgence = {
  'PAM-DG': [
    { nom: 'Diallo', prenom: 'Mamadou', type_contrat: 'CDI', poste: 'Directeur Administratif' },
    { nom: 'Ndiaye', prenom: 'Fatou', type_contrat: 'CDI', poste: 'Assistante de Direction' },
    { nom: 'Ba', prenom: 'Ibrahima', type_contrat: 'CDI', poste: 'Responsable RH' },
    { nom: 'Sow', prenom: 'Aissatou', type_contrat: 'CDI', poste: 'Comptable Senior' },
    { nom: 'Fall', prenom: 'Cheikh', type_contrat: 'CDI', poste: 'Charge Informatique' },
    { nom: 'Gueye', prenom: 'Mariama', type_contrat: 'CDD', poste: 'Secretaire' },
    { nom: 'Mbaye', prenom: 'Ousmane', type_contrat: 'CDD', poste: 'Agent de Securite' },
    { nom: 'Sarr', prenom: 'Rokhaya', type_contrat: 'stage', poste: 'Stagiaire Finance' },
  ],
  'PAM-BENE': [
    { nom: 'Diouf', prenom: 'Amadou', type_contrat: 'CDI', poste: 'Chef Agence' },
    { nom: 'Faye', prenom: 'Ndèye', type_contrat: 'CDI', poste: 'Caissiere Principale' },
    { nom: 'Sy', prenom: 'Modou', type_contrat: 'CDI', poste: 'Agent de Credit' },
    { nom: 'Toure', prenom: 'Bineta', type_contrat: 'CDD', poste: 'Conseillere Clientele' },
    { nom: 'Wade', prenom: 'Lamine', type_contrat: 'CDD', poste: 'Agent Epargne' },
    { nom: 'Cisse', prenom: 'Yacine', type_contrat: 'stage', poste: 'Stagiaire Accueil' },
  ],
  'PAM-CAST': [
    { nom: 'Diop', prenom: 'Serigne', type_contrat: 'CDI', poste: 'Chef Agence' },
    { nom: 'Thiam', prenom: 'Adja', type_contrat: 'CDI', poste: 'Caissiere' },
    { nom: 'Kane', prenom: 'Babacar', type_contrat: 'CDI', poste: 'Agent de Credit' },
    { nom: 'Badji', prenom: 'Marieme', type_contrat: 'CDD', poste: 'Conseiller' },
    { nom: 'Mendy', prenom: 'Pascal', type_contrat: 'CDI', poste: 'Agent Securite' },
    { nom: 'Bassene', prenom: 'Celestine', type_contrat: 'stage', poste: 'Stagiaire' },
  ],
  'PAM-GYOFF': [
    { nom: 'Niang', prenom: 'Pape', type_contrat: 'CDI', poste: 'Chef Agence' },
    { nom: 'Diatta', prenom: 'Marie', type_contrat: 'CDI', poste: 'Caissiere' },
    { nom: 'Coulibaly', prenom: 'Seydou', type_contrat: 'CDI', poste: 'Agent Credit' },
    { nom: 'Traore', prenom: 'Fatoumata', type_contrat: 'CDD', poste: 'Conseillere' },
    { nom: 'Kouyate', prenom: 'Boubacar', type_contrat: 'CDI', poste: 'Agent Terrain' },
  ],
};

// Users par agence (admin local)
const usersAgences = [
  { username: 'admin.dg',    password: 'pamecas2024!', role: 'admin',    nom_complet: 'Admin Direction Generale', agenceCode: 'PAM-DG' },
  { username: 'admin.bene',  password: 'pamecas2024!', role: 'admin',    nom_complet: 'Admin Agence Bene Tally',  agenceCode: 'PAM-BENE' },
  { username: 'admin.cast',  password: 'pamecas2024!', role: 'admin',    nom_complet: 'Admin Agence Castors',     agenceCode: 'PAM-CAST' },
  { username: 'admin.gyoff', password: 'pamecas2024!', role: 'admin',    nom_complet: 'Admin Agence Grand Yoff',  agenceCode: 'PAM-GYOFF' },
  { username: 'point.dg',    password: 'point2024!',   role: 'pointeur', nom_complet: 'Pointeur Direction Gen.',  agenceCode: 'PAM-DG' },
  { username: 'point.bene',  password: 'point2024!',   role: 'pointeur', nom_complet: 'Pointeur Bene Tally',      agenceCode: 'PAM-BENE' },
];

// ─── Helpers ─────────────────────────────────────────────────────
function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function heure(h, m) {
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Genere un statut realiste avec probabilites
function genererStatut(heureArrivee) {
  const [h, m] = heureArrivee.split(':').map(Number);
  const minutes = h * 60 + m;
  if (minutes <= 8 * 60 + 10) return 'present';
  if (minutes <= 8 * 60 + 30) return 'retard';
  return 'absent';
}

async function genererPointagesSemaine(agents, siteId, superviseurId) {
  const pointages = [];
  // 7 derniers jours (lundi-vendredi seulement)
  for (let offset = -6; offset <= 0; offset++) {
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
        if (parseInt(heureArrivee.split(':')[0]) === 7 && parseInt(heureArrivee.split(':')[1]) >= 50) {
          heureArrivee = heure(8, rand(0, 10));
        }
        statut = 'present';
        heureDepart = heure(17, rand(0, 30));
      } else if (roll < 0.88) {
        // Retard leger
        heureArrivee = heure(8, rand(16, 45));
        statut = 'retard';
        heureDepart = heure(17, rand(0, 30));
      } else if (roll < 0.95) {
        // Absent
        statut = 'absent';
        heureArrivee = null;
        heureDepart = null;
      } else {
        // Present mais parti tot
        heureArrivee = heure(8, rand(0, 10));
        statut = 'present';
        heureDepart = heure(15, rand(0, 30));
      }

      let duree = null;
      if (heureArrivee && heureDepart) {
        const [h1, m1] = heureArrivee.split(':').map(Number);
        const [h2, m2] = heureDepart.split(':').map(Number);
        duree = (h2 * 60 + m2) - (h1 * 60 + m1);
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
            methode: Math.random() > 0.4 ? 'qr_code' : 'manuel',
            superviseur_id: superviseurId,
            note: statut === 'absent' && Math.random() > 0.5 ? 'Absence justifiee' : '',
            sync_status: 'synced',
            synced_at: new Date()
          },
          { upsert: true, new: true }
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
      conn.once('connected', resolve);
      conn.once('error', reject);
    });

    console.log('Connexion DB etablie...');

    // 1. Agences
    const sitesMap = {};
    for (const agence of agences) {
      const site = await Site.findOneAndUpdate(
        { code: agence.code },
        { ...agence, actif: true },
        { upsert: true, new: true }
      );
      sitesMap[agence.code] = site;
    }
    await Site.deleteOne({ code: 'GDS-PRINCIPAL' });
    console.log(`${agences.length} agences initialisees`);

    // 2. Superadmin
    const superadminData = {
      username: 'admin',
      password: 'pamecas2024!',
      role: 'superadmin',
      nom_complet: 'Super Administrateur SmartPointage',
      actif: true
    };
    let superadmin = await User.findOne({ username: 'admin' });
    if (!superadmin) {
      superadmin = new User(superadminData);
      await superadmin.save();
      console.log('Superadmin cree');
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
          actif: true
        });
        await u.save();
        console.log(`User cree: ${ud.username} (${ud.role} - ${ud.agenceCode})`);
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
          site_id: site._id
        });
        if (!existing) {
          const agent = new Agent({
            nom: ad.nom,
            prenom: ad.prenom,
            type_contrat: ad.type_contrat,
            poste: ad.poste,
            site_id: site._id,
            actif: true
          });
          await agent.save();
          agentsInseres.push(agent);
          totalAgents++;
        } else {
          agentsInseres.push(existing);
        }
      }

      // Pointages sur 7 jours
      const pointages = await genererPointagesSemaine(agentsInseres, site._id, superadmin._id);
      totalPointages += pointages.length;
      console.log(`${agenceCode}: ${agentsInseres.length} agents, ${pointages.length} pointages`);
    }

    console.log('');
    console.log('=== SEED TERMINE ===');
    console.log(`Agences     : ${agences.length}`);
    console.log(`Agents      : ${totalAgents} nouveaux`);
    console.log(`Pointages   : ${totalPointages} sur 7 jours`);
    console.log('');
    console.log('=== COMPTES DE CONNEXION ===');
    console.log('Superadmin  : admin / pamecas2024!');
    console.log('Admin DG    : admin.dg / pamecas2024!');
    console.log('Admin Bene  : admin.bene / pamecas2024!');
    console.log('Pointeur DG : point.dg / point2024!');
    console.log('');

  } catch (err) {
    console.error('Erreur seed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();