/**
 * seed-cms.js — Seed instance Crédit Mutuel du Sénégal (CMS)
 * Usage : node server/seed-cms.js
 */

const dotenv = require('dotenv');
dotenv.config();

const { connectDB, mongoose } = require('./config/db');
const Site = require('./models/Site');
const User = require('./models/User');
const Agent = require('./models/Agent');
const Tenant = require('./models/Tenant');

// ─── Agences CMS ──────────────────────────────────────────────────
const agences = [
  {
    code: 'CMS-DG',
    nom: 'Direction Générale CMS',
    region: 'Dakar',
    telephone: '33 889 10 00',
    adresse: 'Dakar Plateau, Rue Felix Faure',
    config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false },
  },
  {
    code: 'CMS-GRAND-YOFF',
    nom: 'Agence Grand Yoff',
    region: 'Dakar',
    telephone: '33 867 00 10',
    adresse: 'Grand Yoff, Dakar',
    config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false },
  },
  {
    code: 'CMS-PIKINE',
    nom: 'Agence Pikine',
    region: 'Dakar',
    telephone: '33 867 00 11',
    adresse: 'Pikine Icotaf, Dakar',
    config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false },
  },
  {
    code: 'CMS-GUEDIAWAYE',
    nom: 'Agence Guédiawaye',
    region: 'Dakar',
    telephone: '33 867 00 12',
    adresse: 'Guédiawaye, Dakar',
    config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false },
  },
  {
    code: 'CMS-THIES',
    nom: 'Agence Thiès',
    region: 'Thiès',
    telephone: '33 951 00 10',
    adresse: 'Centre Ville, Thiès',
    config: { heure_debut: '08:00', heure_retard: '08:15', weekend_actif: false },
  },
];

// ─── Agents par agence CMS ───────────────────────────────────────
const agentsParAgence = {
  'CMS-DG': [
    { matricule: 'CMS-DG-001', prenom: 'Mamadou', nom: 'Diallo', poste: 'Directeur General', type_contrat: 'CDI' },
    { matricule: 'CMS-DG-002', prenom: 'Aissatou', nom: 'Sow', poste: 'Secretaire DG', type_contrat: 'CDI' },
    { matricule: 'CMS-DG-003', prenom: 'Cheikh', nom: 'Mbaye', poste: 'Comptable Chef', type_contrat: 'CDI' },
    { matricule: 'CMS-DG-004', prenom: 'Fatou', nom: 'Diop', poste: 'Chargee RH', type_contrat: 'CDI' },
    { matricule: 'CMS-DG-005', prenom: 'Ibrahima', nom: 'Fall', poste: 'Responsable IT', type_contrat: 'CDI' },
    { matricule: 'CMS-DG-006', prenom: 'Rokhaya', nom: 'Ndiaye', poste: 'Assistante Direction', type_contrat: 'CDI' },
    { matricule: 'CMS-DG-007', prenom: 'Modou', nom: 'Sarr', poste: 'Chauffeur', type_contrat: 'CDD' },
    { matricule: 'CMS-DG-008', prenom: 'Astou', nom: 'Cisse', poste: 'Agent de securite', type_contrat: 'CDD' },
  ],
  'CMS-GRAND-YOFF': [
    { matricule: 'CMS-GY-001', prenom: 'Ousmane', nom: 'Diouf', poste: 'Chef Agence', type_contrat: 'CDI' },
    { matricule: 'CMS-GY-002', prenom: 'Mariama', nom: 'Ba', poste: 'Caissiere', type_contrat: 'CDI' },
    { matricule: 'CMS-GY-003', prenom: 'Abdou', nom: 'Niang', poste: 'Agent de Credit', type_contrat: 'CDI' },
    { matricule: 'CMS-GY-004', prenom: 'Seynabou', nom: 'Gaye', poste: 'Caissiere', type_contrat: 'CDD' },
    { matricule: 'CMS-GY-005', prenom: 'Lamine', nom: 'Thiaw', poste: 'Gestionnaire Compte', type_contrat: 'CDI' },
    { matricule: 'CMS-GY-006', prenom: 'Ndeye', nom: 'Faye', poste: 'Agent Accueil', type_contrat: 'CDD' },
  ],
  'CMS-PIKINE': [
    { matricule: 'CMS-PK-001', prenom: 'Babacar', nom: 'Diallo', poste: 'Chef Agence', type_contrat: 'CDI' },
    { matricule: 'CMS-PK-002', prenom: 'Coumba', nom: 'Mbodj', poste: 'Caissiere', type_contrat: 'CDI' },
    { matricule: 'CMS-PK-003', prenom: 'Samba', nom: 'Diagne', poste: 'Agent de Credit', type_contrat: 'CDI' },
    { matricule: 'CMS-PK-004', prenom: 'Aminata', nom: 'Toure', poste: 'Agent Accueil', type_contrat: 'CDD' },
    { matricule: 'CMS-PK-005', prenom: 'Pape', nom: 'Gueye', poste: 'Gestionnaire Compte', type_contrat: 'CDI' },
    { matricule: 'CMS-PK-006', prenom: 'Yacine', nom: 'Wade', poste: 'Caissiere', type_contrat: 'CDD' },
  ],
  'CMS-GUEDIAWAYE': [
    { matricule: 'CMS-GW-001', prenom: 'Assane', nom: 'Lo', poste: 'Chef Agence', type_contrat: 'CDI' },
    { matricule: 'CMS-GW-002', prenom: 'Khady', nom: 'Diop', poste: 'Caissiere', type_contrat: 'CDI' },
    { matricule: 'CMS-GW-003', prenom: 'Moussa', nom: 'Ndour', poste: 'Agent de Credit', type_contrat: 'CDI' },
    { matricule: 'CMS-GW-004', prenom: 'Binta', nom: 'Sall', poste: 'Agent Accueil', type_contrat: 'CDD' },
    { matricule: 'CMS-GW-005', prenom: 'Thierno', nom: 'Kane', poste: 'Gestionnaire Compte', type_contrat: 'CDI' },
    { matricule: 'CMS-GW-006', prenom: 'Dieynaba', nom: 'Samb', poste: 'Caissiere', type_contrat: 'CDD' },
  ],
  'CMS-THIES': [
    { matricule: 'CMS-TH-001', prenom: 'Cheikh', nom: 'Diallo', poste: 'Chef Agence', type_contrat: 'CDI' },
    { matricule: 'CMS-TH-002', prenom: 'Sokhna', nom: 'Mbaye', poste: 'Caissiere', type_contrat: 'CDI' },
    { matricule: 'CMS-TH-003', prenom: 'Momar', nom: 'Ndiaye', poste: 'Agent de Credit', type_contrat: 'CDI' },
    { matricule: 'CMS-TH-004', prenom: 'Awa', nom: 'Badji', poste: 'Agent Accueil', type_contrat: 'CDD' },
    { matricule: 'CMS-TH-005', prenom: 'Alioune', nom: 'Tine', poste: 'Gestionnaire Compte', type_contrat: 'CDI' },
    { matricule: 'CMS-TH-006', prenom: 'Rama', nom: 'Dieye', poste: 'Caissiere', type_contrat: 'CDD' },
  ],
};

// ─── Comptes utilisateurs CMS ─────────────────────────────────────
const usersCMS = [
  {
    username: 'admin.cms',
    password: 'cms2024!',
    role: 'superadmin',
    nom_complet: 'Super Admin CMS',
    agenceCode: null,
  },
  {
    username: 'directeur.cms',
    password: 'cms2024!',
    role: 'directeur_regional',
    nom_complet: 'Directeur Régional CMS Dakar',
    agenceCode: null,
    allSites: true,
  },
  {
    username: 'admin.dg@cms',
    password: 'cms2024!',
    role: 'admin',
    nom_complet: 'Admin Direction Générale CMS',
    agenceCode: 'CMS-DG',
  },
  {
    username: 'admin.gyoff@cms',
    password: 'cms2024!',
    role: 'admin',
    nom_complet: 'Admin Agence Grand Yoff CMS',
    agenceCode: 'CMS-GRAND-YOFF',
  },
  {
    username: 'admin.pikine@cms',
    password: 'cms2024!',
    role: 'admin',
    nom_complet: 'Admin Agence Pikine CMS',
    agenceCode: 'CMS-PIKINE',
  },
  {
    username: 'admin.guediawaye@cms',
    password: 'cms2024!',
    role: 'admin',
    nom_complet: 'Admin Agence Guédiawaye CMS',
    agenceCode: 'CMS-GUEDIAWAYE',
  },
  {
    username: 'admin.thies@cms',
    password: 'cms2024!',
    role: 'admin',
    nom_complet: 'Admin Agence Thiès CMS',
    agenceCode: 'CMS-THIES',
  },
  {
    username: 'point.dg@cms',
    password: 'point2024!',
    role: 'pointeur',
    nom_complet: 'Pointeur Direction Générale CMS',
    agenceCode: 'CMS-DG',
  },
];

// ─── Main seed ────────────────────────────────────────────────────
async function seedCMS() {
  await connectDB();
  console.log('✅ Connecté à MongoDB');
  console.log('Connexion DB etablie...');

  // 1. Upsert du Tenant CMS
  let tenant = await Tenant.findOne({ slug: 'cms' });
  if (!tenant) {
    tenant = new Tenant({
      nom: 'Crédit Mutuel du Sénégal',
      slug: 'cms',
      url: 'https://smartpointage.digitalesf.com',
      plan: 'pro',
      statut: 'actif',
      contact: {
        nom: 'Direction CMS',
        email: 'contact@cms.sn',
        telephone: '33 889 10 00',
      },
      configuration: {
        couleur_theme: '#1565C0',
        instance_name: 'Crédit Mutuel du Sénégal',
      },
      tarif_mensuel: 120000,
      nb_sites: agences.length,
    });
    await tenant.save();
    console.log('✅ Tenant CMS créé');
  } else {
    tenant.configuration.couleur_theme = '#1565C0';
    tenant.configuration.instance_name = 'Crédit Mutuel du Sénégal';
    tenant.statut = 'actif';
    await tenant.save();
    console.log('✅ Tenant CMS mis à jour');
  }

  // 2. Créer les agences
  const siteMap = {};
  for (const agence of agences) {
    let site = await Site.findOne({ code: agence.code });
    if (!site) {
      site = new Site({
        code: agence.code,
        nom: agence.nom,
        region: agence.region,
        telephone: agence.telephone,
        adresse: agence.adresse,
        actif: true,
        config: agence.config,
        instance_slug: 'cms',
      });
      await site.save();
      console.log(`  ✅ Agence créée: ${agence.code}`);
    } else {
      if (!site.instance_slug || site.instance_slug === 'pamecas') {
        site.instance_slug = 'cms';
        await site.save();
      }
      console.log(`  ℹ️  Agence existante: ${agence.code}`);
    }
    siteMap[agence.code] = site;
  }

  console.log(`\n${agences.length} agences CMS initialisees`);

  // 3. Créer les agents
  let totalAgents = 0;
  for (const [code, agents] of Object.entries(agentsParAgence)) {
    const site = siteMap[code];
    if (!site) continue;

    let nouveaux = 0;
    for (const a of agents) {
      const existing = await Agent.findOne({ matricule: a.matricule });
      if (!existing) {
        await Agent.create({
          matricule: a.matricule,
          prenom: a.prenom,
          nom: a.nom,
          poste: a.poste,
          type_contrat: a.type_contrat || 'CDI',
          site_id: site._id,
          statut: 'actif',
          date_entree: new Date('2020-01-01'),
          instance_slug: 'cms',
        });
        nouveaux++;
        totalAgents++;
      } else if (!existing.instance_slug || existing.instance_slug === 'pamecas') {
        existing.instance_slug = 'cms';
        await existing.save();
      }
    }
    console.log(`${code}: ${agents.length} agents (${nouveaux} nouveaux)`);
  }

  // 4. Créer les users
  const allSiteIds = Object.values(siteMap).map((s) => s._id);

  for (const u of usersCMS) {
    const existing = await User.findOne({ username: u.username });
    if (existing) {
      // Mettre à jour instance_slug si manquant
      if (!existing.instance_slug || existing.instance_slug === 'pamecas') {
        existing.instance_slug = 'cms';
        await existing.save();
      }
      console.log(`  ℹ️  User existant: ${u.username}`);
      continue;
    }

    const siteId = u.agenceCode ? siteMap[u.agenceCode]?._id : null;
    const sitesIds = u.allSites ? allSiteIds : siteId ? [siteId] : [];

    const newUser = new User({
      username: u.username,
      password: u.password,
      role: u.role,
      nom_complet: u.nom_complet,
      site_id: siteId || null,
      sites_ids: sitesIds,
      instance_slug: 'cms',
      actif: true,
    });
    await newUser.save();
    console.log(`  ✅ User créé: ${u.username}`);
  }

  // 5. Résumé
  console.log('\n=== SEED CMS TERMINE ===');
  console.log(`Agences     : ${agences.length}`);
  console.log(`Agents      : ${totalAgents} nouveaux`);
  console.log('\n=== COMPTES DE CONNEXION CMS ===');
  console.log('Super Admin : admin.cms / cms2024!');
  console.log('Directeur   : directeur.cms / cms2024!');
  console.log('Admin DG    : admin.dg@cms / cms2024!');
  console.log('Admin GYoff : admin.gyoff@cms / cms2024!');
  console.log('Pointeur DG : point.dg@cms / point2024!');
  console.log('\n🎨 Branding CMS : #1565C0 (Bleu Crédit Mutuel)');

  await mongoose.disconnect();
  console.log('⚠️  Déconnecté de MongoDB');
}

seedCMS().catch((err) => {
  console.error('Erreur seed CMS:', err);
  process.exit(1);
});
