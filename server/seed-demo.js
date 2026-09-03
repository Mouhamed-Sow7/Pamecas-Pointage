/**
 * seed-demo.js — Jeu de données démo réaliste (pointages + congés)
 * pour les 3 tenants : PAMECAS, CMS, ASERGMV/GMV
 *
 * Génère 30 jours de pointages et des congés réalistes.
 * Usage : node server/seed-demo.js
 *
 * Prérequis : lancer seed.js, seed-cms.js et seed-gmv.js d'abord.
 */

const dotenv = require("dotenv");
dotenv.config();

const { connectDB, mongoose } = require("./config/db");
const Site = require("./models/Site");
const Agent = require("./models/Agent");
const Pointage = require("./models/Pointage");
const Conge = require("./models/Conge");

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

function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

// Distribution réaliste des statuts (%)
function genererStatut(heureArrivee, heureDebut) {
  const [hA, mA] = heureArrivee.split(":").map(Number);
  const [hD, mD] = heureDebut.split(":").map(Number);
  const minutesArrivee = hA * 60 + mA;
  const minutesDebut = hD * 60 + mD;

  if (minutesArrivee <= minutesDebut + 5) return "present";
  if (minutesArrivee <= minutesDebut + 20) return "retard";
  return "retard";
}

// Probabilités réalistes selon le poste
function getArriveeProbabilite(poste) {
  // Cadres arrivent souvent plus tôt, agents de terrain plus variables
  const cadres = [
    "Directeur", "Responsable", "Chef", "DRH", "DAF", "Comptable",
  ];
  const isCadre = cadres.some((c) => poste.includes(c));
  return isCadre
    ? { onTime: 0.85, late: 0.12, absent: 0.03 }
    : { onTime: 0.75, late: 0.18, absent: 0.07 };
}

function genererHeureArrivee(proba, heureDebut, config) {
  const r = Math.random();
  const [hD, mD] = heureDebut.split(":").map(Number);
  const debutMinutes = hD * 60 + mD;

  if (r < proba.absent) return null; // absent

  let minutes;
  if (r < proba.onTime + proba.absent) {
    // À l'heure ou en avance : entre -15min et +5min
    minutes = debutMinutes + rand(-15, 5);
  } else {
    // En retard : entre +6min et +30min
    minutes = debutMinutes + rand(6, 30);
  }

  // Ne pas descendre avant 6h du matin
  if (minutes < 6 * 60) minutes = 6 * 60 + rand(0, 30);
  // Ne pas dépasser 11h
  if (minutes > 11 * 60) minutes = 11 * 60 - rand(0, 30);

  return heure(Math.floor(minutes / 60), minutes % 60);
}

function genererHeureDepart(heureArrivee, estPartiel) {
  if (estPartiel) {
    // Départ avant midi (demi-journée)
    const h = rand(11, 13);
    return heure(h, rand(0, 30));
  }
  const [hA, mA] = heureArrivee.split(":").map(Number);
  let minutesArrivee = hA * 60 + mA;
  // Journée complète : 7h à 9h de travail
  const duree = rand(7 * 60 + 30, 9 * 60);
  let minutesDepart = minutesArrivee + duree;
  // Ne pas dépasser 19h
  if (minutesDepart > 19 * 60) minutesDepart = 18 * 60 + rand(0, 30);
  return heure(Math.floor(minutesDepart / 60), minutesDepart % 60);
}

function calculerDuree(arrivee, depart) {
  if (!arrivee || !depart) return null;
  const [hA, mA] = arrivee.split(":").map(Number);
  const [hD, mD] = depart.split(":").map(Number);
  return hD * 60 + mD - (hA * 60 + mA);
}

// Coordonnées GPS réalistes pour les sites avec coordonnées connues
const COORDS_PAR_DEFAUT = {
  "PAM-STL": { latitude: 16.02409, longitude: -16.494215 },
  "PAM-DG": { latitude: 14.6937, longitude: -17.4441 },
  "PAM-BENE": { latitude: 14.6945, longitude: -17.4478 },
  "PAM-BOURG": { latitude: 14.693, longitude: -17.443 },
  "PAM-CAST": { latitude: 14.695, longitude: -17.45 },
  "PAM-AVION": { latitude: 14.696, longitude: -17.448 },
  "PAM-GYOFF": { latitude: 14.71, longitude: -17.455 },
  "PAM-HLM": { latitude: 14.692, longitude: -17.446 },
  "PAM-OUAK": { latitude: 14.718, longitude: -17.47 },
  "PAM-VDN": { latitude: 14.705, longitude: -17.46 },
  "PAM-YOFF": { latitude: 14.735, longitude: -17.47 },
};

// ─── Types de congés réalistes avec motifs ───────────────────────
const TYPES_CONGE = [
  { type: "annuel", motif: "Congé annuel", nbJours: [5, 15] },
  { type: "annuel", motif: "Vacances familiales", nbJours: [3, 10] },
  { type: "annuel", motif: "Congé de repos", nbJours: [2, 7] },
  { type: "maladie", motif: "Arrêt maladie", nbJours: [2, 5] },
  { type: "maladie", motif: "Consultation médicale", nbJours: [1, 2] },
  { type: "exceptionnel", motif: "Mariage", nbJours: [3, 5] },
  { type: "exceptionnel", motif: "Deuil familial", nbJours: [3, 5] },
  { type: "exceptionnel", motif: "Naissance", nbJours: [3, 3] },
  { type: "maternite", motif: "Congé maternité", nbJours: [30, 45] },
];

// ─── Distribution des agents en congé par site ───────────────────
// On veut des agents absents sur des périodes variées
const CONGES_PLANIFIES = [
  // PAMECAS — 3 agents en congé
  { siteCode: "PAM-DG", agentNom: "Diallo", agentPrenom: "Mamadou", decalage: -15, duree: 10, type: "annuel", motif: "Congé annuel", statut: "approuve" },
  { siteCode: "PAM-BENE", agentNom: "Toure", agentPrenom: "Modou", decalage: -10, duree: 5, type: "annuel", motif: "Vacances familiales", statut: "approuve" },
  { siteCode: "PAM-CAST", agentNom: "Tendeng", agentPrenom: "Malick", decalage: -5, duree: 7, type: "maladie", motif: "Arrêt maladie", statut: "approuve" },
  { siteCode: "PAM-DG", agentNom: "Gueye", agentPrenom: "Aissatou", decalage: -3, duree: 3, type: "exceptionnel", motif: "Mariage", statut: "en_attente" },
  { siteCode: "PAM-HLM", agentNom: "Manga", agentPrenom: "Lamine", decalage: -20, duree: 5, type: "annuel", motif: "Congé de repos", statut: "approuve" },
  { siteCode: "PAM-YOFF", agentNom: "Traore", agentPrenom: "Babacar", decalage: -8, duree: 4, type: "exceptionnel", motif: "Deuil familial", statut: "approuve" },
  // CMS — 3 agents en congé
  { siteCode: "CMS-DG", agentNom: "Diallo", agentPrenom: "Mamadou", decalage: -12, duree: 8, type: "annuel", motif: "Congé annuel", statut: "approuve" },
  { siteCode: "CMS-GRAND-YOFF", agentNom: "Diouf", agentPrenom: "Ousmane", decalage: -7, duree: 4, type: "maladie", motif: "Consultation médicale", statut: "approuve" },
  { siteCode: "CMS-PIKINE", agentNom: "Diallo", agentPrenom: "Babacar", decalage: -18, duree: 12, type: "annuel", motif: "Vacances familiales", statut: "approuve" },
  // GMV — 3 agents en congé
  { siteCode: "GMV-SL-RAO", agentNom: "Sow", agentPrenom: "Moussa", decalage: -14, duree: 6, type: "annuel", motif: "Congé annuel", statut: "approuve" },
  { siteCode: "GMV-LG-WIDOU", agentNom: "Ndiaye", agentPrenom: "Pape", decalage: -9, duree: 5, type: "exceptionnel", motif: "Naissance", statut: "approuve" },
  { siteCode: "GMV-TB-BAKEL", agentNom: "Diallo", agentPrenom: "Boubacar", decalage: -4, duree: 3, type: "maladie", motif: "Arrêt maladie", statut: "en_attente" },
];

// ─── Main ─────────────────────────────────────────────────────────

async function seedDemo() {
  try {
    await connectDB();
    await new Promise((resolve, reject) => {
      const conn = mongoose.connection;
      if (conn.readyState === 1) return resolve();
      conn.once("connected", resolve);
      conn.once("error", reject);
    });

    console.log("Connexion DB établie.");

    // 1. Nettoyer les anciennes données de démo (pointages + congés)
    const pointagesAvant = await Pointage.countDocuments();
    const congesAvant = await Conge.countDocuments();
    console.log(`Pointages existants : ${pointagesAvant}`);
    console.log(`Congés existants : ${congesAvant}`);

    // On ne supprime pas tout — on remplace les données générées
    // (identifiées par note contenant "[demo]")
    const delPointages = await Pointage.deleteMany({ note: /\[demo\]/ });
    const delConges = await Conge.deleteMany({ motif: /\[demo\]/ });
    console.log(`Pointages [demo] supprimés : ${delPointages.deletedCount}`);
    console.log(`Congés [demo] supprimés : ${delConges.deletedCount}`);

    // 2. Charger tous les sites et agents
    const sites = await Site.find({}).lean();
    const agents = await Agent.find({ statut: "actif" }).populate("site_id").lean();

    console.log(`\nSites chargés : ${sites.length}`);
    console.log(`Agents actifs : ${agents.length}`);

    // Indexer les sites par code
    const siteMap = {};
    for (const site of sites) {
      siteMap[site.code] = site;
    }

    // Indexer les agents par site + nom/prénom
    const agentsBySite = {};
    for (const agent of agents) {
      const site = agent.site_id;
      if (!site) continue;
      const code = site.code || siteMap[site._id]?.code;
      if (!code) continue;
      if (!agentsBySite[code]) agentsBySite[code] = [];
      agentsBySite[code].push(agent);
    }

    // 3. Générer les congés planifiés
    let congesCrees = 0;
    for (const plan of CONGES_PLANIFIES) {
      const site = siteMap[plan.siteCode];
      if (!site) {
        console.log(`  ⚠️ Site ${plan.siteCode} introuvable, skip congé`);
        continue;
      }

      // Chercher l'agent par nom/prénom dans le site
      const agentsDuSite = agentsBySite[plan.siteCode] || [];
      const agent = agentsDuSite.find(
        (a) => a.nom === plan.agentNom && a.prenom === plan.agentPrenom,
      );
      if (!agent) {
        console.log(`  ⚠️ Agent ${plan.agentNom} ${plan.agentPrenom} (${plan.siteCode}) introuvable, skip`);
        continue;
      }

      const dateDebut = dateStr(plan.decalage);
      const dateFin = dateStr(plan.decalage + plan.duree);

      const conge = new Conge({
        agent_id: agent._id,
        site_id: site._id,
        date_debut: dateDebut,
        date_fin: dateFin,
        nb_jours: plan.duree,
        type: plan.type,
        motif: `${plan.motif} [demo]`,
        statut: plan.statut,
        commentaire_rh: plan.statut === "approuve" ? "Approuvé [demo]" : "En attente de validation [demo]",
        instance_slug: site.instance_slug || "pamecas",
      });

      // Éviter les doublons
      const existing = await Conge.findOne({
        agent_id: agent._id,
        date_debut: dateDebut,
        date_fin: dateFin,
        motif: /\[demo\]/,
      });
      if (!existing) {
        await conge.save();
        congesCrees++;
        console.log(`  ✅ Congé créé: ${agent.nom} ${agent.prenom} (${plan.siteCode}) — ${plan.motif} du ${dateDebut} au ${dateFin}`);
      }
    }
    console.log(`\nTotal congés créés : ${congesCrees}`);

    // 4. Générer les pointages pour les 30 derniers jours
    const JOURS = 30;
    let pointagesCrees = 0;
    let pointagesSkipped = 0;

    for (let jour = -JOURS; jour <= 0; jour++) {
      const date = dateStr(jour);
      const dateObj = new Date(date);
      const jourSemaine = dateObj.getDay(); // 0=dim, 6=sam

      for (const [code, agentsList] of Object.entries(agentsBySite)) {
        const site = siteMap[code];
        if (!site) continue;

        const config = site.config || { heure_debut: "08:00", weekend_actif: false };

        // Skip weekend si pas actif
        if ((jourSemaine === 0 || jourSemaine === 6) && !config.weekend_actif) {
          continue;
        }

        const heureDebut = config.heure_debut || "08:00";

        for (const agent of agentsList) {
          // Vérifier si l'agent est en congé ce jour
          const enConge = await Conge.findOne({
            agent_id: agent._id,
            date_debut: { $lte: date },
            date_fin: { $gte: date },
            statut: "approuve",
          });

          if (enConge) {
            // Créer un pointage "conge" pour ce jour
            const existing = await Pointage.findOne({
              agent_id: agent._id,
              site_id: site._id,
              date: date,
            });
            if (!existing) {
              await Pointage.create({
                agent_id: agent._id,
                site_id: site._id,
                date: date,
                statut: "conge",
                methode: "manuel",
                note: "En congé [demo]",
                sync_status: "synced",
                synced_at: new Date(),
                instance_slug: site.instance_slug || "pamecas",
              });
              pointagesCrees++;
            }
            continue;
          }

          // Éviter les doublons
          const existing = await Pointage.findOne({
            agent_id: agent._id,
            site_id: site._id,
            date: date,
          });
          if (existing) {
            pointagesSkipped++;
            continue;
          }

          const proba = getArriveeProbabilite(agent.poste || "");
          const heureArrivee = genererHeureArrivee(proba, heureDebut, config);

          if (heureArrivee === null) {
            // Absent
            await Pointage.create({
              agent_id: agent._id,
              site_id: site._id,
              date: date,
              statut: "absent",
              methode: "manuel",
              note: "Absent non justifié [demo]",
              sync_status: "synced",
              synced_at: new Date(),
              instance_slug: site.instance_slug || "pamecas",
            });
            pointagesCrees++;
            continue;
          }

          // 5% de demi-journées
          const estPartiel = Math.random() < 0.05;
          const heureDepart = genererHeureDepart(heureArrivee, estPartiel);
          const dureeMinutes = calculerDuree(heureArrivee, heureDepart);
          const statut = genererStatut(heureArrivee, heureDebut);

          // Coordonnées GPS (utiliser celles du site si disponibles)
          const coords = site.coordonnees || COORDS_PAR_DEFAUT[code] || null;
          const jitter = () => (Math.random() - 0.5) * 0.002; // ±~100m

          await Pointage.create({
            agent_id: agent._id,
            site_id: site._id,
            date: date,
            heure_arrivee: heureArrivee,
            heure_depart: heureDepart,
            duree_minutes: dureeMinutes,
            statut: estPartiel ? "partiel" : statut,
            methode: Math.random() < 0.7 ? "qr_code" : "manuel",
            note: estPartiel ? "Départ anticipé [demo]" : "[demo]",
            sync_status: "synced",
            synced_at: new Date(),
            coordonnees_arrivee: coords
              ? {
                  latitude: coords.latitude + jitter(),
                  longitude: coords.longitude + jitter(),
                  precision: rand(5, 20),
                }
              : null,
            coordonnees_depart: coords
              ? {
                  latitude: coords.latitude + jitter(),
                  longitude: coords.longitude + jitter(),
                  precision: rand(5, 20),
                }
              : null,
            est_partiel: estPartiel,
            justification_partiel: estPartiel ? "Rendez-vous personnel [demo]" : null,
            instance_slug: site.instance_slug || "pamecas",
          });
          pointagesCrees++;
        }
      }
    }

    console.log(`\n=== SEED DEMO TERMINÉ ===`);
    console.log(`Congés créés      : ${congesCrees}`);
    console.log(`Pointages créés   : ${pointagesCrees}`);
    console.log(`Pointages ignorés (existaient déjà) : ${pointagesSkipped}`);

    // Résumé par tenant
    const tenants = ["pamecas", "cms", "gmv"];
    for (const slug of tenants) {
      const nb = await Pointage.countDocuments({ instance_slug: slug, note: /\[demo\]/ });
      const nbC = await Conge.countDocuments({ instance_slug: slug, motif: /\[demo\]/ });
      const nbA = await Agent.countDocuments({ instance_slug: slug });
      console.log(`  ${slug}: ${nbA} agents, ${nb} pointages [demo], ${nbC} congés [demo]`);
    }

  } catch (err) {
    console.error("Erreur seed-demo:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedDemo();